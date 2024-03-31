import { v4 as uuidv4 } from 'uuid';

import omit from 'lodash/omit';
import APIQueue from './';
import {
  ChatCompletionRequestMessageRoleEnum,
  CreateChatCompletionRequest,
  CreateChatCompletionResponseChoicesInner,
} from '../../types/openai';

interface Message {
  content: string;
  role: ChatCompletionRequestMessageRoleEnum;
  uuid: string;
  parent: string | null;
}

export interface Config extends Omit<CreateChatCompletionRequest, 'messages'> {
  head?: string | null;
  callId?: number;
}

type ResponseMessage = Omit<CreateChatCompletionRequest['messages'][number], 'name'>;

type ProxiedFunction = (content: string) => Promise<ProxiedAgent>;
type ProxiedAgent = ProxiedFunction & InstanceType<typeof Agent>;

export default class Agent {
  static api: APIQueue;
  public cost: number;
  public choices: CreateChatCompletionResponseChoicesInner[];
  private static _dag: Map<string, Message> = new Map();

  private _head: string | null;
  private _config: Config;
  private callId: number;

  public static create(
    config: Config = { model: 'gpt-4', callId: 0 },
    cost: number = 0,
    choices: CreateChatCompletionResponseChoicesInner[] = [],
  ): ProxiedAgent {
    const instance = new Agent(config, cost, choices);
    const func: ProxiedFunction = async (content: string): Promise<ProxiedAgent> =>
      await instance.chat(content);

    return new Proxy(func, {
      get: (target: any, prop: string, receiver: any): any => {
        if (prop in target) {
          return target[prop];
        } else {
          // @ts-ignore
          return typeof instance[prop] === 'function'
            ? // @ts-ignore
              instance[prop].bind(instance)
            : // @ts-ignore
              instance[prop];
        }
      },
      set: (target: any, prop: string, value: any): boolean => {
        if (prop in target) {
          target[prop] = value;
        } else {
          // @ts-ignore
          instance[prop] = value;
        }
        return true;
      },
      apply: (target: ProxiedFunction, thisArg: any, argumentsList: any[]): any => {
        // @ts-ignore
        return target(...argumentsList);
      },
      construct: (target: any, argumentsList: any[], newTarget: any): any => {
        // @ts-ignore
        return new Agent(...argumentsList);
      },
    }) as ProxiedAgent;
  }

  constructor(
    config: Config,
    cost: number,
    choices: CreateChatCompletionResponseChoicesInner[],
  ) {
    this._head = config.head || null;
    this._config = config;
    this.cost = cost;
    this.callId = config.callId || 0;
    this.choices = choices;
  }

  get head(): Message | undefined {
    return Agent._dag.get(this._head!);
  }

  get content(): string {
    return this.head!.content;
  }

  get messages(): ResponseMessage[] {
    let currentUUID = this._head;
    const messages: ResponseMessage[] = [];

    while (currentUUID !== null) {
      const { content, role } = Agent._dag.get(currentUUID)!;
      messages.push({ content, role });
      currentUUID = Agent._dag.get(currentUUID)!.parent;
    }

    return messages.reverse();
  }

  public extend(newConfig: Config): ProxiedAgent {
    const mergedConfig: Config = {
      ...this._config,
      ...newConfig,
      head: this._head,
    };
    return Agent.create(mergedConfig);
  }

  public async chat(content: string): Promise<ProxiedAgent> {
    const stashedHead = this._head;
    const uuid: string = this.createMessage(content, 'user');
    this._head = uuid;
    const { content: apiResponse, cost, choices } = await this.callApi(this.messages);
    this._head = stashedHead;
    const assistantUuid: string = this.createMessage(apiResponse, 'assistant', uuid);
    return this.createNewAgent(assistantUuid, cost, choices);
  }

  public async retry(): Promise<ProxiedAgent> {
    let lastUserMessage: Message | undefined = this.head;
    while (lastUserMessage?.role !== 'user') {
      if (!lastUserMessage?.parent) throw new Error('No user message found for retry');
      lastUserMessage = Agent._dag.get(lastUserMessage.parent);
    }
    // Create a new agent that's based on the parent of the last user message
    const newAgentConfig: Config = {
      ...this._config,
      head: lastUserMessage.parent,
      callId: this.callId + 1,
    };
    const newAgent = Agent.create(newAgentConfig, this.cost);
    // Then call chat on the new agent with the same message as before
    return newAgent.chat(lastUserMessage.content.split(' ').slice(1).join(' '));
  }

  public system(partial: string): ProxiedAgent {
    return this.createNewAgent(
      this.createMessage(partial, 'system'),
      this.cost,
      this.choices,
    );
  }

  private createMessage(
    content: string,
    role: ChatCompletionRequestMessageRoleEnum,
    parent: string | null = this._head,
  ): string {
    const uuid = uuidv4();
    if (role === 'user') {
      content = `${this.callId.toString().padStart(2, '0')} ${content}`;
    }
    const message: Message = { content, role, uuid, parent };
    Agent._dag.set(uuid, message);
    return uuid;
  }

  private createNewAgent(
    head: string,
    cost: number,
    choices: CreateChatCompletionResponseChoicesInner[],
  ): ProxiedAgent {
    const newConfig: Config = {
      ...this._config,
      head,
      callId: this.callId,
    };
    return Agent.create(newConfig, cost, choices);
  }

  private async callApi(
    messages: ResponseMessage[],
  ): Promise<{ content: string; cost: number; choices: any[] }> {
    const request: CreateChatCompletionRequest = {
      ...omit(this._config, 'head', 'choices', 'callId'),
      messages: messages as any,
    };
    const response = await Agent.api.request(request);

    if (!response) {
      throw new Error('unable to get api response');
    }
    const content = response!.choices[0]!.message!.content!;
    const cost =
      (this.cost as number) +
      response.usage?.prompt_tokens! +
      response.usage?.completion_tokens! * 2;

    return { content, cost, choices: response!.choices };
  }
}
