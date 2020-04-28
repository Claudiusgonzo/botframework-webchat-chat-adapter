/// <reference path="../types/ic3/external/Model.d.ts" />

import { compose } from 'redux';

import { ActivityMessageThread } from '../types/ic3/ActivityMessageThread';
import { AdapterCreator, AdapterEnhancer, ReadyState } from '../types/AdapterTypes';
import { HostType } from '../types/ic3/HostType';
import { IC3AdapterState, StateKey } from '../types/ic3/IC3AdapterState';
import { IIC3AdapterOptions } from '../types/ic3/IIC3AdapterOptions';
import { ProtocolType } from '../types/ic3/ProtocolType';
import applyIngressMiddleware from '../applyIngressMiddleware';
import createEgressEnhancer from './enhancers/egress';
import createIngressEnhancer from './enhancers/ingress';
import createSubscribeNewMessageEnhancer from './enhancers/subscribeNewMessage';
import createSubscribeThreadUpdateEnhancer from './enhancers/subscribeThreadUpdate';
import getPlatformBotId from './utils/getPlatformBotId';
import initializeIC3SDK from './initializeIC3SDK';

export default async function createIC3Enhancer({
  chatToken,
  hostType,
  logger,
  protocolType,
  sdkUrl,
  sdkURL,
  userDisplayName,
  userId,
  visitor
}: IIC3AdapterOptions & { sdkUrl: string }): Promise<AdapterEnhancer<ActivityMessageThread, IC3AdapterState>> {
  if (!chatToken) {
    throw new Error('"chatToken" must be specified.');
  }

  if (sdkUrl && !sdkURL) {
    console.warn(
      'IC3: "sdkUrl" has been renamed to "sdkURL". Please rename accordingly to suppress this warning in the future.'
    );
    sdkURL = sdkUrl;
  }

  hostType = hostType ?? HostType.IFrame;
  protocolType = protocolType ?? ProtocolType.IC3V1SDK;
  visitor = visitor ?? true;

  const sdk = await initializeIC3SDK(
    sdkURL,
    {
      hostType,
      protocolType,
      logger
    },
    {
      regionGtms: chatToken.regionGTMS,
      token: chatToken.token,
      visitor
    }
  );

  const conversation = await sdk.joinConversation(chatToken.chatId);
  const botId = await getPlatformBotId(conversation);

  return compose(
    (next: AdapterCreator<ActivityMessageThread, IC3AdapterState>) => (options: IC3AdapterState) => {
      const adapter = next(options);

      adapter.setConfig(StateKey.BotId, botId);
      adapter.setConfig(StateKey.UserDisplayName, userDisplayName);
      adapter.setConfig(StateKey.UserId, userId);
      adapter.setReadyState(ReadyState.OPEN);

      return adapter;
    },
    createSubscribeNewMessageEnhancer(conversation),
    createSubscribeThreadUpdateEnhancer(conversation),
    createEgressEnhancer(conversation),
    createIngressEnhancer(conversation),
    applyIngressMiddleware(() => next => (activityMessageThread: ActivityMessageThread) => {
      // We are only ingressing Direct Line Activity
      if ('activity' in activityMessageThread) {
        next(activityMessageThread.activity);
      }
    })
  );
}
