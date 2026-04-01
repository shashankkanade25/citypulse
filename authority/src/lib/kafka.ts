import { Kafka } from "@upstash/kafka";

/* ------------------------------------------------------------------ */
/*  Upstash Kafka singleton                                           */
/*  Env vars:                                                         */
/*    UPSTASH_KAFKA_REST_URL   – REST endpoint                        */
/*    UPSTASH_KAFKA_REST_USERNAME – SASL username                     */
/*    UPSTASH_KAFKA_REST_PASSWORD – SASL password                     */
/*    KAFKA_ENABLED            – set to "true" to activate            */
/* ------------------------------------------------------------------ */

let _kafka: Kafka | null = null;

function getKafka(): Kafka | null {
  if (process.env.KAFKA_ENABLED !== "true") return null;

  if (!_kafka) {
    const url = process.env.UPSTASH_KAFKA_REST_URL;
    const username = process.env.UPSTASH_KAFKA_REST_USERNAME;
    const password = process.env.UPSTASH_KAFKA_REST_PASSWORD;

    if (!url || !username || !password) {
      console.warn("[kafka] Missing UPSTASH_KAFKA_REST_* env vars — events disabled.");
      return null;
    }

    _kafka = new Kafka({ url, username, password });
  }
  return _kafka;
}

/* ------------------------------------------------------------------ */
/*  Topics (authority)                                                */
/* ------------------------------------------------------------------ */

export const TOPICS = {
  INCIDENT_MODERATED: "incident.moderated",
  INCIDENT_STATUS_CHANGED: "incident.status_changed",
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  INCIDENT_ASSIGNED: "incident.status_changed",
  ABUSE_ACTION: "abuse.action",
  CONFIG_UPDATED: "config.updated",
  AUDIT_EVENT: "audit.event",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/* ------------------------------------------------------------------ */
/*  Event payload types                                               */
/* ------------------------------------------------------------------ */

export interface KafkaEvent<T = unknown> {
  /** ISO-8601 timestamp */
  ts: string;
  /** Originating service */
  source: "authority" | "citizens";
  /** Topic / event type */
  topic: TopicName;
  /** Unique event key (usually entity ID) */
  key: string;
  /** Payload */
  data: T;
}

/* ------------------------------------------------------------------ */
/*  Fire-and-forget publisher                                         */
/* ------------------------------------------------------------------ */

/**
 * Publish an event to Upstash Kafka. Silently swallows errors
 * so a Kafka outage never blocks the primary request path.
 */
export async function publishEvent<T = unknown>(
  topic: TopicName,
  key: string,
  data: T,
): Promise<void> {
  const kafka = getKafka();
  if (!kafka) return;

  const event: KafkaEvent<T> = {
    ts: new Date().toISOString(),
    source: "authority",
    topic,
    key,
    data,
  };

  try {
    const producer = kafka.producer();
    await producer.produce(topic, JSON.stringify(event), { key });
  } catch (err) {
    // Never let Kafka failures break the request
    console.error(`[kafka] Failed to publish ${topic}/${key}:`, err);
  }
}
