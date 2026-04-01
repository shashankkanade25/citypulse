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
/*  Topics (citizens)                                                 */
/* ------------------------------------------------------------------ */

export const TOPICS = {
  ISSUE_CREATED: "issue.created",
  ISSUE_STATUS_CHANGED: "issue.status_changed",
  CITIZEN_CREATED: "citizen.created",
  CITIZEN_UPDATED: "citizen.updated",
  CITIZEN_DELETED: "citizen.deleted",
  USER_CREATED: "user.created",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/* ------------------------------------------------------------------ */
/*  Event payload types                                               */
/* ------------------------------------------------------------------ */

export interface KafkaEvent<T = unknown> {
  ts: string;
  source: "authority" | "citizens";
  topic: TopicName;
  key: string;
  data: T;
}

/* ------------------------------------------------------------------ */
/*  Fire-and-forget publisher                                         */
/* ------------------------------------------------------------------ */

export async function publishEvent<T = unknown>(
  topic: TopicName,
  key: string,
  data: T,
): Promise<void> {
  const kafka = getKafka();
  if (!kafka) return;

  const event: KafkaEvent<T> = {
    ts: new Date().toISOString(),
    source: "citizens",
    topic,
    key,
    data,
  };

  try {
    const producer = kafka.producer();
    await producer.produce(topic, JSON.stringify(event), { key });
  } catch (err) {
    console.error(`[kafka] Failed to publish ${topic}/${key}:`, err);
  }
}
