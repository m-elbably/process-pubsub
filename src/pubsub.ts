import {EventEmitter} from 'events';

export interface BaseSubscription {
    channel: string;
    topic: string;
    callback: (message: any, metadata?: any) => void;
}

export interface Subscription extends BaseSubscription{
    once?: boolean;
}

export interface RequestReplyOptions {
    timeout?: number;
}

export interface Options {
    requestReplyTimeout?: number;
}

const REQUEST_REPLY_DEFAULT_TIMEOUT = 2000;

export class PubSub {
    private readonly _channels: any = {};
    private readonly _eventEmitter: EventEmitter = new EventEmitter();
    private _options: Options = {
        requestReplyTimeout: REQUEST_REPLY_DEFAULT_TIMEOUT
    };

    constructor(options?: Options) {
        if (options) {
            Object.keys(options).forEach((key: keyof Options) => {
                (this._options as { [k: string]: any })[key] = options[key];
            });
        }
    }

    _validateChannelAndTopic(channel: string, topic: string): void {
        if (channel == null) {
            throw new Error(`Invalid channel name, channel name can not be null or undefined`);
        }

        if (topic == null) {
            throw new Error(`Invalid topic name, please provide topic name or "*" to subscribe on all topics within a channel`);
        }
    }

    _subscribe(subscription: Subscription): void {
        const {channel, topic, callback, once} = subscription;
        this._validateChannelAndTopic(channel, topic);

        const event = `${channel}.${topic}`;
        const listenersCount = this._eventEmitter.listenerCount(event);
        // Create channel if it's not there
        if (this._channels[channel] == null) {
            this._channels[channel] = {
                topics: {[topic]: [callback]}
            };
        } else if (this._channels[channel].topics[topic] == null) {
            // Create topic within channel if it's not there
            this._channels[channel].topics[topic] = [callback];
        } else {
            // Push the new topic within channel if topic exists
            this._channels[channel].topics[topic].push(callback);
        }

        if (listenersCount + 1 >= this._eventEmitter.getMaxListeners()) {
            this._eventEmitter.setMaxListeners(listenersCount + 1);
        }

        if (once === true) {
            const mCallback = (payload: any) => {
                const metadata = {channel, topic};
                callback(payload, metadata);
                if (this._channels[channel] != null &&
                    this._channels[channel].topics[topic] != null
                ) {
                    const topicListeners = this._channels[channel].topics[topic];
                    const eventListenerIndex = topicListeners.indexOf(callback);
                    topicListeners.splice(eventListenerIndex, 1);
                }
            };
            // Adds a one-time listener function for the event named eventName.
            // The next time eventName is triggered, this listener is removed and then invoked.
            this._eventEmitter.once(event, mCallback);
        } else {
            this._eventEmitter.addListener(event, callback);
        }
    }

    /**
     * Subscribe to channel and topic
     * @param {...Subscription} subscriptions
     */
    subscribe(...subscriptions: Array<Subscription>): void {
        subscriptions.forEach((subscription) =>
            this._subscribe(subscription));
    }

    _unsubscribe(subscription: BaseSubscription): void {
        const {channel, topic, callback} = subscription;
        this._validateChannelAndTopic(channel, topic);

        if (this._channels[channel] == null ||
            this._channels[channel].topics[topic] == null ||
            this._channels[channel].topics[topic].length === 0
        ) {
            return;
        }

        const topicListeners = this._channels[channel].topics[topic];
        const eventListenerIndex = topicListeners.indexOf(callback);
        const eventName = `${channel}.${topic}`;

        if (eventListenerIndex >= 0) {
            topicListeners.splice(eventListenerIndex, 1);
        }

        this._eventEmitter.removeListener(eventName, callback);
    }

    /**
     * Unsubscribe a specific subscription
     * @param {...Subscription} subscriptions
     */
    unsubscribe(...subscriptions: Array<BaseSubscription>): void {
        subscriptions.forEach((subscription) =>
            this._unsubscribe(subscription));
    }

    _unsubscribeAll(channel: string, topic: string): void {
        this._validateChannelAndTopic(channel, topic);
        if (this._channels[channel] == null) {
            return;
        }

        if (topic === '*') {
            // Remove all registered subscribers under all topics within channel
            const {topics} = this._channels[channel];
            if (topics != null && Object.keys(topics).length > 0) {
                Object.keys(topics).forEach((t) => {
                    const topicListeners = this._channels[channel].topics[t];
                    this._eventEmitter.removeAllListeners(`${channel}.${t}`);
                    this._channels[channel].topics[t].splice(0, topicListeners.length);
                });
            }
        } else {
            // Remove all registered subscribers under provided topic within channel
            const topicListeners = this._channels[channel].topics[topic];
            this._eventEmitter.removeAllListeners(`${channel}.${topic}`);
            this._channels[channel].topics[topic].splice(0, topicListeners.length);
        }
    }

    /**
     * Unsubscribe all subscribers under a channel and topic
     * @param {string} channel
     * @param {string} topic
     */
    unsubscribeAll(channel: string, topic: string): void {
        if (channel === '*') {
            Object.keys(this._channels).forEach((ch) => {
                this._unsubscribeAll(ch, topic);
            });
        } else {
            this._unsubscribeAll(channel, topic);
        }
    }

    /**
     * Get options
     * @returns {Options}
     */
    options(): Options {
        return this._options;
    }

    /**
     * Get core event emitter instance
     * @returns {EventEmitter}
     */
    emitter(): EventEmitter {
        return this._eventEmitter;
    }

    /**
     * Get all channels names
     * @returns {Array<string>}
     */
    channels(): Array<string> {
        return Object.keys(this._channels).map((k) => k);
    }

    /**
     * Get all topics names in a specific channel
     * @param {string} channel
     * @returns {Array<string>}
     */
    topics(channel: string): Array<string> {
        if (channel == null || this._channels[channel] == null) {
            return [];
        }

        return Object.keys(this._channels[channel].topics).map((k) => k);
    }

    /**
     * Get all subscribers in a channel and topic
     * all subscribers in a channel can be retrieved with global channel (channel = '*')
     * all subscribers in all topics in channel can be retrieved with global topic (topic = '*')
     * @param {string} channel
     * @param {string} topic
     * @returns {Array<Function>}
     */
    subscribers(channel: string, topic: string = '*'): Array<Function> {
        const subscribers: Array<Function> = [];
        const channels: string[] = [];

        if (channel === '*') {
            Object.keys(this._channels).forEach((ch) => {
                channels.push(ch);
            });
        } else {
            channels.push(channel)
        }

        for (let i = 0; i < channels.length; i++) {
            const cChannel = channels[i];
            if (this._channels[cChannel] == null) {
                continue;
            }
            if (topic === '*') {
                const {topics} = this._channels[cChannel];
                if (topics != null && Object.keys(topics).length > 0) {
                    Object.keys(topics).forEach((t) => {
                        const topicListeners = this._channels[cChannel].topics[t];
                        subscribers.push(...topicListeners);
                    });
                }
            } else {
                const topicListeners = this._channels[cChannel].topics[topic];
                if (topicListeners != null) {
                    subscribers.push(...topicListeners);
                }
            }
        }

        return subscribers;
    }

    /**
     * Publish message to channel, topic
     * Global channel publishing is possible if topic name is '*', in this case
     * all subscribers under all topics within channel will receive message
     * @param {string} channel
     * @param {string} topic
     * @param {any} message
     */
    publish(channel: string, topic: string, message: any): void {
        this._validateChannelAndTopic(channel, topic);
        const metadata = {channel, topic};
        if (this._channels[channel] == null) {
            throw new Error(`Channel ${channel} does not exists, make sure that you have subscribers to get channel created`);
        }

        if (topic === '*') {
            const topics = this.topics(channel);
            if (topics.length > 0) {
                topics.forEach((topic) => {
                    const event = `${channel}.${topic}`;
                    const listeners = this._eventEmitter.listeners(event);
                    if(listeners.length > 0) {
                        this._eventEmitter.emit(event, message, metadata);
                    }
                });
            }
        } else {
            const event = `${channel}.${topic}`;
            const listeners = this._eventEmitter.listeners(event);
            if (listeners.length > 0) {
                this._eventEmitter.emit(event, message, metadata);
            }

            // Global topic for channel
            const gEvent = `${channel}.*`;
            const gListeners = this._eventEmitter.listeners(gEvent);
            if (gListeners.length > 0) {
                this._eventEmitter.emit(gEvent, message, metadata);
            }
        }
    }

    /**
     * Request-Reply pattern
     * Result will be returned from first listener only
     * @param {string} channel
     * @param {string} topic
     * @param {any} message
     * @param {RequestReplyOptions} options
     * @returns {Promise<any>}
     */
    async publishAndGetReply(channel: string, topic: string, message: any, options: RequestReplyOptions = {}): Promise<any> {
        this._validateChannelAndTopic(channel, topic);
        const metadata = {channel, topic};
        const timeout = options.timeout || this._options.requestReplyTimeout;
        const event = `${channel}.${topic}`;
        const listeners = this._eventEmitter.listeners(event);

        if (listeners.length === 0) {
            throw new Error(`No subscribers for event ${event}, At least one subscriber must be exists to process response-reply requests`);
        }

        let timer: ReturnType<typeof setTimeout>;
        const handler = listeners[0];
        // We can not catch setTimeout error normally as it goes to the main loop
        const timeoutGuard = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Event reply timeout after ${timeout} ms`));
            }, timeout);
        });

        return Promise.race([timeoutGuard, handler(message, metadata)])
            .then((result) => {
                clearTimeout(timer);
                return result;
            });
    }
}
