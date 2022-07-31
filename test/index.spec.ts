import {expect} from "chai";
import {before, after, describe, it} from "mocha"
import {PubSub, Subscription} from "../src";
import {EventEmitter} from "events";

let pubsub: PubSub;
let subscriptions: Subscription[] = [];
// Channels and topics
const CHANNEL_USERS = 'users';
const CHANNEL_ORDERS = 'orders';
const TOPICS_CREATED = 'created';
const TOPICS_UPDATED = 'updated';

class Deferred<T> {
    public resolve: (arg?: any) => void;
    public reject: (arg?: any) => void;
    public promise: Promise<T>;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

before(() => {
    pubsub = new PubSub({
        requestReplyTimeout: 1000
    });
});

describe('General functionalities', () => {
    it('Should return options object', async () => {
        const options = pubsub.options();
        expect(options)
            .to.be.an('object')
            .with.ownProperty('requestReplyTimeout')
            .equal(1000);
    });

    it('Should return core event emitter instance', async () => {
        const emitter = pubsub.emitter();
        expect(emitter)
            .to.be.an.instanceOf(EventEmitter);
    });
});

describe('Subscribe', () => {
    before(() => {
        for (let i = 0; i < 12; i++) {
            const channel = (i < 6) ? CHANNEL_USERS : CHANNEL_ORDERS;
            const topics = [TOPICS_CREATED, TOPICS_UPDATED];
            for (let j = 0; j < topics.length; j++) {
                const topic = topics[j];
                const name = `${i}-${j}`;
                subscriptions.push({
                    channel,
                    topic,
                    callback: {
                        [name](message: any) {
                            console.log(message as string);
                        }
                    }[name]
                });
            }
        }
    });

    it('Should received error trying to subscribe with invalid channel name', () => {
        try {
            pubsub.subscribe({
                channel: null,
                topic: null,
                callback: () => {
                }
            });
        } catch (e) {
            expect(e)
                .to.be.an('Error')
                .with.ownProperty('message')
                .contains('Invalid channel name');
        }
    });

    it('Should received error trying to subscribe with invalid topic name', () => {
        try {
            pubsub.subscribe({
                channel: CHANNEL_USERS,
                topic: null,
                callback: () => {
                }
            });
        } catch (e) {
            expect(e)
                .to.be.an('Error')
                .with.ownProperty('message')
                .contains('Invalid topic name');
        }
    });

    it('Should have 2 channel created with 2 topics for each channel', () => {
        pubsub.subscribe(...subscriptions);

        const channels = pubsub.channels();
        const topics = pubsub.topics(CHANNEL_USERS);

        expect(channels)
            .to.be.an('array')
            .with.length(2)
            .and.includes.members([CHANNEL_USERS, CHANNEL_ORDERS]);
        expect(topics)
            .to.be.an('array')
            .with.length(2)
            .and.includes.members([TOPICS_CREATED, TOPICS_UPDATED]);
    });

    it('Should have 12 subscribers registered with users channel', () => {
        const subscribers = pubsub.subscribers(CHANNEL_USERS);
        expect(subscribers)
            .to.be.an('array')
            .with.length(12);
    });

    it('Should have 6 subscriber registered in topic "created"', () => {
        const subscribers = pubsub.subscribers(CHANNEL_USERS, TOPICS_CREATED);
        expect(subscribers)
            .to.be.an('array')
            .with.length(6);
    });

    it('Should have 6 subscribers registered in topic "updated"', () => {
        const subscribers = pubsub.subscribers(CHANNEL_ORDERS, TOPICS_UPDATED);
        expect(subscribers)
            .to.be.an('array')
            .with.length(6);

        // expect(subscribers[0].name === subscriptions[13].callback.name)
        //     .to.be.true;
    });

    it(`Should have all subscribers registered in channel "${CHANNEL_ORDERS}"`, () => {
        const subscribers = pubsub.subscribers(CHANNEL_ORDERS, '*');
        expect(subscribers)
            .to.be.an('array')
            .with.length(12);
    });

    it(`Should have all subscribers registered in "${TOPICS_CREATED}" topic in all channels`, () => {
        const subscribers = pubsub.subscribers('*', TOPICS_CREATED);
        expect(subscribers)
            .to.be.an('array')
            .with.length(12);
    });

    it(`Should have all subscribers registered in all channels`, () => {
        const subscribers = pubsub.subscribers('*', '*');
        expect(subscribers)
            .to.be.an('array')
            .with.length(24);
    });
});

describe('Unsubscribe', () => {
    it('Should ignore subscribers removal if channel is null or undefined', () => {
        pubsub.unsubscribeAll('users-a', '*');
        const subscribers = pubsub.subscribers('*');
        expect(subscribers)
            .to.be.an('array')
            .with.length(24);
    });

    it('Should ignore subscribers removal if channel or topic does not exists', async () => {
        pubsub.unsubscribe({
            channel: CHANNEL_USERS,
            topic: 'Blah',
            callback: () => {
            }
        });

        const subscribers = pubsub.subscribers(CHANNEL_USERS);
        expect(subscribers)
            .to.be.an('array')
            .with.length(12);
    });

    it('Should have first subscriber removed from topic "created"', async () => {
        pubsub.unsubscribe(subscriptions[0]);

        const subscribers = pubsub.subscribers(subscriptions[0].channel, subscriptions[0].topic);
        expect(subscribers)
            .to.be.an('array')
            .with.length(5);
    });

    it('Should have all subscribers removed from topic "created"', async () => {
        pubsub.unsubscribeAll(CHANNEL_USERS, TOPICS_CREATED);

        const subscribers = pubsub.subscribers(CHANNEL_USERS, TOPICS_CREATED);
        expect(subscribers)
            .to.be.an('array')
            .with.length(0);
    });

    it('Should have all subscribers removed from topic "updated"', async () => {
        pubsub.unsubscribeAll(CHANNEL_ORDERS, '*');

        const subscribers = pubsub.subscribers(CHANNEL_ORDERS, '*');
        expect(subscribers)
            .to.be.an('array')
            .with.length(0);
    });

    it('Should have all subscribers removed from all channels', async () => {
        pubsub.unsubscribeAll('*', '*');

        const subscribers = pubsub.subscribers('*', '*');
        expect(subscribers)
            .to.be.an('array')
            .with.length(0);
    });
});

describe('Publish', () => {
    it('Should get an error when publishing to channel that does not exists', async () => {
        try {
            pubsub.publish('channel', 'topic', {});
        } catch (e) {
            expect(e)
                .to.be.an('Error')
                .with.ownProperty('message')
                .that.include('Channel channel does not exists');
        }
    });

    it('Should get an error when publishing to channel that does not exists', async () => {
        const deferred = new Deferred<void>();
        const CHANNEL = 'Group';
        const TOPIC = 'Added';

        pubsub.subscribe({
            channel: CHANNEL,
            topic: TOPIC,
            once: true,
            callback: (message: any) => {
                deferred.resolve(message);
            }
        });

        const sBefore = pubsub.subscribers(CHANNEL, TOPIC);
        pubsub.publish(CHANNEL, TOPIC, {
            id: 'G1',
            count: 120
        });

        await deferred.promise;
        const sAfter = pubsub.subscribers(CHANNEL, TOPIC);

        expect(sBefore)
            .to.be.an('array')
            .with.length(1);
        expect(sAfter)
            .to.be.an('array')
            .with.length(0);
    });

    it('Should have topic subscriber notified with the published message', async () => {
        const deferred = new Deferred<void>();
        pubsub.subscribe({
            channel: CHANNEL_ORDERS,
            topic: TOPICS_CREATED,
            callback: (message: any) => {
                deferred.resolve(message);
            }
        });

        pubsub.publish(CHANNEL_ORDERS, TOPICS_CREATED, {
            id: 1,
            amount: 120
        });

        const result = await deferred.promise;
        expect(result)
            .to.be.an('object')
            .with.ownProperty('amount')
            .equal(120);
    });

    it('Should have multiple subscribers notified with the published message', async () => {
        const s1 = new Deferred<void>();
        const s2 = new Deferred<void>();

        pubsub.subscribe({
            channel: CHANNEL_ORDERS,
            topic: TOPICS_UPDATED,
            callback: (message: any) => {
                s1.resolve(message);
            }
        }, {
            channel: CHANNEL_ORDERS,
            topic: TOPICS_UPDATED,
            callback: (message: any) => {
                s2.resolve(message);
            }
        });

        pubsub.publish(CHANNEL_ORDERS, TOPICS_UPDATED, {
            id: 1,
            amount: 150
        });

        const s1Result = await s1.promise;
        const s2Result = await s2.promise;

        expect(s1Result)
            .to.be.an('object')
            .with.ownProperty('amount')
            .equal(150);

        expect(s2Result)
            .to.be.an('object')
            .with.ownProperty('amount')
            .equal(150);
    });

    it('Should have multiple subscribers in different topic notified with the published message', async () => {
        const s1 = new Deferred<void>();
        const s2 = new Deferred<void>();

        pubsub.unsubscribeAll('*', '*');
        pubsub.subscribe({
            channel: CHANNEL_ORDERS,
            topic: TOPICS_CREATED,
            callback: (message: any) => {
                s1.resolve(message);
            }
        }, {
            channel: CHANNEL_ORDERS,
            topic: TOPICS_UPDATED,
            callback: (message: any) => {
                s2.resolve(message);
            }
        });

        pubsub.publish(CHANNEL_ORDERS, '*', {
            id: 1,
            amount: 150
        });

        const s1Result = await s1.promise;
        const s2Result = await s2.promise;

        expect(s1Result)
            .to.be.an('object')
            .with.ownProperty('amount')
            .equal(150);

        expect(s2Result)
            .to.be.an('object')
            .with.ownProperty('amount')
            .equal(150);
    });

    it('Should receive global channel notification if message published to any topic', async () => {
        const deferred = new Deferred<void>();
        pubsub.unsubscribeAll('*', '*');
        pubsub.subscribe({
            channel: CHANNEL_ORDERS,
            topic: '*',
            callback: (message) => {
                deferred.resolve(message);
            }
        });

        pubsub.publish(CHANNEL_ORDERS, TOPICS_CREATED, {id: 0, createdAt: Date.now()});
        const result = await deferred.promise;

        expect(result)
            .to.be.an('object')
            .with.ownProperty('id')
            .equal(0);
    });

    it('Should receive callback metadata with message payload if message published to topic', async () => {
        let cMetadata: any;
        const deferred = new Deferred<void>();

        pubsub.unsubscribeAll('*', '*');
        pubsub.subscribe({
            channel: CHANNEL_ORDERS,
            topic: '*',
            callback: (message, metadata) => {
                cMetadata = metadata;
                deferred.resolve(message);
            }
        });

        pubsub.publish(CHANNEL_ORDERS, TOPICS_CREATED, {id: 0, createdAt: Date.now()});
        await deferred.promise;

        expect(cMetadata)
            .to.be.an('object')
            .with.ownProperty('channel')
            .equal(CHANNEL_ORDERS);

        expect(cMetadata)
            .to.be.an('object')
            .with.ownProperty('topic')
            .equal(TOPICS_CREATED);
    });

    it('Should have subscriber waiting for reply on published message', async () => {
        pubsub.unsubscribeAll('*', '*');
        pubsub.subscribe({
            channel: CHANNEL_USERS,
            topic: TOPICS_CREATED,
            callback: (message: any) => {
                message.name += ' 1';
                return message;
            }
        }, {
            channel: CHANNEL_USERS,
            topic: TOPICS_CREATED,
            callback: (message: any) => {
                message.name += ' 2';
                return message;
            }
        });

        const result = await pubsub.publishAndGetReply(CHANNEL_USERS, TOPICS_CREATED, {
            id: 1,
            name: 'mars'
        });

        expect(result)
            .to.be.an('object')
            .with.ownProperty('name')
            .equal('mars 1');
    });

    it('Should get timeout error if reply on published message exceeded 1 second', async () => {
        pubsub.unsubscribeAll('*', '*');
        pubsub.subscribe({
            channel: CHANNEL_USERS,
            topic: TOPICS_CREATED,
            callback: async (message: any) => {
                return new Promise((resolve, reject) => {
                    setTimeout(()=> {
                        resolve(message);
                    }, 1500);
                });
            }
        });

        try {
            const result = await pubsub.publishAndGetReply(CHANNEL_USERS, TOPICS_CREATED, {
                id: 1,
                name: 'mars'
            });
        } catch (e) {
            expect(e)
                .to.be.an('Error')
                .with.ownProperty('message')
                .that.include('timeout');
        }
    });

    it('Should get an error when publishing to channel or topic with no subscribers', async () => {
        pubsub.unsubscribeAll('*', '*');
        try {
            const result = await pubsub.publishAndGetReply('channel', 'topic', {
                id: 1,
                name: 'mars'
            });
        } catch (e) {
            expect(e)
                .to.be.an('Error')
                .with.ownProperty('message')
                .that.include('No subscribers');
        }
    });
});
