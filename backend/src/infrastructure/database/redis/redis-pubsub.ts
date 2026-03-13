import { getRedisPublisher, getRedisSubscriber } from "./redis-client";

type MessageHandler<T> = (message: T) => void | Promise<void>;

export class RedisPubSub {
  async publish<T>(channel: string, payload: T): Promise<number> {
    return getRedisPublisher().publish(channel, JSON.stringify(payload));
  }

  async subscribe<T>(channel: string, handler: MessageHandler<T>): Promise<void> {
    const subscriber = getRedisSubscriber();
    await subscriber.subscribe(channel);

    subscriber.on("message", (incomingChannel, message) => {
      if (incomingChannel !== channel) {
        return;
      }

      void handler(JSON.parse(message) as T);
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await getRedisSubscriber().unsubscribe(channel);
  }
}
