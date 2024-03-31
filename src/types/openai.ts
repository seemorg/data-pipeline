import type OpenAI from 'openai';

import type { APIPromise } from 'openai/core';

export type CreateChatCompletionRequest =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

export type CreateChatCompletionResponse =
  APIPromise<OpenAI.Chat.Completions.ChatCompletion>;

export type ChatCompletionRequestMessageRoleEnum =
  OpenAI.Chat.Completions.ChatCompletionRole;

export type CreateChatCompletionResponseChoicesInner =
  OpenAI.Chat.Completions.ChatCompletion.Choice;
