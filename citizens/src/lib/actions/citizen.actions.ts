'use server';

import { connectToDatabase } from '@/lib/database/mongoose';
import Citizen from '@/lib/database/models/citizen.model';
import { 
  CreateCitizenParams, 
  UpdateCitizenParams, 
  CitizenProfile,
  DatabaseResponse 
} from '@/types';
import { revalidatePath } from 'next/cache';
import { dualWritePostgresFirst } from '@/lib/server/dualWrite';
import { withPgClient } from '@/lib/postgres';
import { publishEvent, TOPICS } from '@/lib/kafka';

/**
 * Create a new citizen in the database
 */
export async function createCitizen(
  params: CreateCitizenParams
): Promise<DatabaseResponse<CitizenProfile>> {
  try {
    await connectToDatabase();

    const citizen = await dualWritePostgresFirst({
      pg: async (client) => {
        await client.query(
          `INSERT INTO users (external_id, name, email, username, photo, role, is_active, active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'CITIZEN', true, true, now(), now())
           ON CONFLICT (external_id) DO NOTHING`,
          [
            params.clerkId,
            [params.firstName, params.lastName].filter(Boolean).join(' '),
            params.email,
            params.username ?? null,
            params.photo ?? null,
          ],
        );
      },
      primary: async () => {
        return await Citizen.create(params);
      },
    });

    publishEvent(TOPICS.CITIZEN_CREATED, params.clerkId, { clerkId: params.clerkId, email: params.email });

    return {
      success: true,
      data: citizen ? JSON.parse(JSON.stringify(citizen)) : ({ clerkId: params.clerkId, email: params.email } as unknown as CitizenProfile),
      message: 'Citizen created successfully',
    };
  } catch (error: any) {
    console.error('Error creating citizen:', error);
    return {
      success: false,
      error: error.message || 'Failed to create citizen',
    };
  }
}

/**
 * Get citizen by Clerk ID
 */
export async function getCitizenByClerkId(
  clerkId: string
): Promise<DatabaseResponse<CitizenProfile>> {
  try {
    await connectToDatabase();

    const citizen = await Citizen.findOne({ clerkId });

    if (!citizen) {
      return {
        success: false,
        error: 'Citizen not found',
      };
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(citizen)),
    };
  } catch (error: any) {
    console.error('Error getting citizen:', error);
    return {
      success: false,
      error: error.message || 'Failed to get citizen',
    };
  }
}

/**
 * Update citizen information
 */
export async function updateCitizen(
  params: UpdateCitizenParams
): Promise<DatabaseResponse<CitizenProfile>> {
  try {
    const { clerkId, ...updateData } = params;

    await connectToDatabase();

    const citizen = await dualWritePostgresFirst({
      pg: async (client) => {
        // Map fields to PG columns
        const sets: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        if (updateData.firstName || updateData.lastName) {
          sets.push(`name = $${idx++}`);
          values.push([updateData.firstName, updateData.lastName].filter(Boolean).join(' '));
        }
        if (updateData.username) { sets.push(`username = $${idx++}`); values.push(updateData.username); }
        if (updateData.phone) { sets.push(`phone = $${idx++}`); values.push(updateData.phone); }
        if (updateData.photo) { sets.push(`photo = $${idx++}`); values.push(updateData.photo); }
        sets.push(`updated_at = now()`);

        if (sets.length > 1) {
          await client.query(
            `UPDATE users SET ${sets.join(', ')} WHERE external_id = $${idx}`,
            [...values, clerkId],
          );
        }
      },
      primary: async () => {
        return await Citizen.findOneAndUpdate(
          { clerkId },
          { $set: updateData },
          { new: true, runValidators: true }
        );
      },
    });

    if (!citizen) {
      return {
        success: false,
        error: 'Citizen not found',
      };
    }

    revalidatePath('/');
    revalidatePath('/profile');

    publishEvent(TOPICS.CITIZEN_UPDATED, clerkId, { clerkId, fields: Object.keys(updateData) });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(citizen)),
      message: 'Citizen updated successfully',
    };
  } catch (error: any) {
    console.error('Error updating citizen:', error);
    return {
      success: false,
      error: error.message || 'Failed to update citizen',
    };
  }
}

/**
 * Delete citizen by Clerk ID
 */
export async function deleteCitizen(
  clerkId: string
): Promise<DatabaseResponse<null>> {
  try {
    await connectToDatabase();

    await dualWritePostgresFirst({
      pg: async (client) => {
        await client.query(
          `DELETE FROM users WHERE external_id = $1 AND role = 'CITIZEN'`,
          [clerkId],
        );
      },
      primary: async () => {
        await Citizen.findOneAndDelete({ clerkId });
        return null;
      },
    });

    revalidatePath('/');

    publishEvent(TOPICS.CITIZEN_DELETED, clerkId, { clerkId });

    return {
      success: true,
      message: 'Citizen deleted successfully',
    };
  } catch (error: any) {
    console.error('Error deleting citizen:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete citizen',
    };
  }
}

/**
 * Get all citizens (admin only)
 */
export async function getAllCitizens(): Promise<DatabaseResponse<CitizenProfile[]>> {
  try {
    await connectToDatabase();

    const citizens = await Citizen.find({})
      .sort({ createdAt: -1 })
      .limit(100);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(citizens)),
    };
  } catch (error: any) {
    console.error('Error getting citizens:', error);
    return {
      success: false,
      error: error.message || 'Failed to get citizens',
    };
  }
}

/**
 * Search citizens by name or email
 */
export async function searchCitizens(
  query: string
): Promise<DatabaseResponse<CitizenProfile[]>> {
  try {
    await connectToDatabase();

    const citizens = await Citizen.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .limit(20)
      .sort({ firstName: 1 });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(citizens)),
    };
  } catch (error: any) {
    console.error('Error searching citizens:', error);
    return {
      success: false,
      error: error.message || 'Failed to search citizens',
    };
  }
}
