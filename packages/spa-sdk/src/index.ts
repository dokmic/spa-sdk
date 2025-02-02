/*
 * Copyright 2019-2021 Hippo B.V. (http://www.onehippo.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Main entry point of the spa-sdk library.
 * @module index
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { SpaModule, SpaService, Spa, ApiOptionsToken } from './spa';
import { CmsService, Cms, CmsModule, PostMessageService, PostMessage } from './cms';
import {
  PageModel,
  PageModule09,
  PageModule,
  Page,
  isPage,
} from './page';
import {
  Configuration,
  ConfigurationWithProxy,
  ConfigurationWithJwt09,
  ConfigurationWithJwt10,
  isConfigurationWithJwt09,
  isConfigurationWithProxy,
} from './configuration';
import { LoggerModule, Logger, Level } from './logger';
import {
  UrlModule09,
  UrlModule,
  UrlBuilderOptionsToken,
  appendSearchParams,
  extractSearchParams,
  isMatched,
  parseUrl,
} from './url';

const DEFAULT_AUTHORIZATION_PARAMETER = 'token';
const DEFAULT_SERVER_ID_PARAMETER = 'server-id';

const container = new Container({ skipBaseClassChecks: true });
const pages = new WeakMap<Page, Container>();

container.load(CmsModule(), LoggerModule(), UrlModule());

function onReady<T>(value: T | Promise<T>, callback: (value: T) => unknown): T | Promise<T> {
  const wrapper = (result: T) => (callback(result), result);

  return value instanceof Promise
    ? value.then(wrapper)
    : wrapper(value);
}

function initializeWithProxy(scope: Container, configuration: ConfigurationWithProxy, model?: PageModel) {
  const logger = scope.get(Logger);

  logger.info('Enabled reverse-proxy based setup.');
  logger.warn('This setup is deprecated and will not work in the next major release.');
  logger.debug('Path:', configuration.path ?? configuration.request?.path ?? '/');
  logger.debug('Base URL:', configuration.options.preview.spaBaseUrl);

  const options = isMatched(
      configuration.path ?? configuration.request?.path ?? '/',
      configuration.options.preview.spaBaseUrl,
    )
    ? configuration.options.preview
    : configuration.options.live;

  logger.info(`Using ${options === configuration.options.preview ? 'preview' : 'live'} configuration.`);

  scope.load(PageModule09(), SpaModule(), UrlModule09());
  scope.bind(ApiOptionsToken).toConstantValue(configuration);
  scope.bind(UrlBuilderOptionsToken).toConstantValue(options);
  scope.getNamed<Cms>(CmsService, 'cms14').initialize(configuration);

  return onReady(
    scope.get<Spa>(SpaService).initialize(model ?? configuration.path ?? configuration.request?.path ?? '/'),
    () => {
      scope.unbind(ApiOptionsToken);
      scope.unbind(UrlBuilderOptionsToken);
    },
  );
}

function initializeWithJwt09(scope: Container, configuration: ConfigurationWithJwt09, model?: PageModel) {
  const logger = scope.get(Logger);

  logger.info('Enabled token-based setup.');
  logger.info('Using Page Model API 0.9.');
  logger.warn('This version of the Page Model API is deprecated and will be removed in the next major release.');

  const authorizationParameter = configuration.authorizationQueryParameter ?? DEFAULT_AUTHORIZATION_PARAMETER;
  const serverIdParameter = configuration.serverIdQueryParameter ?? DEFAULT_SERVER_ID_PARAMETER;
  const { url: path, searchParams } = extractSearchParams(
    configuration.path ?? configuration.request?.path ?? '/',
    [authorizationParameter, serverIdParameter].filter(Boolean),
  );
  const authorizationToken = searchParams.get(authorizationParameter) ?? undefined;
  const serverId = searchParams.get(serverIdParameter) ?? undefined;
  const config = {
    ...configuration,
    origin: configuration.origin ?? parseUrl(configuration.apiBaseUrl ?? configuration.cmsBaseUrl ?? '').origin,
    spaBaseUrl: appendSearchParams(configuration.spaBaseUrl ?? '', searchParams),
  };

  if (authorizationToken) {
    logger.debug('Token:', authorizationToken);
  }

  if (serverId) {
    logger.debug('Server Id:', serverId);
  }

  logger.debug('Origin:', config.origin);
  logger.debug('Path:', path);
  logger.debug('Base URL:', config.spaBaseUrl);

  scope.load(PageModule09(), SpaModule(), UrlModule09());
  scope.bind(ApiOptionsToken).toConstantValue({ authorizationToken, serverId, ...config });
  scope.bind(UrlBuilderOptionsToken).toConstantValue(config);

  return onReady(
    scope.get<Spa>(SpaService).initialize(model ?? path),
    (page) => {
      if (page.isPreview() && config.cmsBaseUrl) {
        logger.info('Running in preview mode.');
        scope.get<PostMessage>(PostMessageService).initialize(config);
        scope.get<Cms>(CmsService).initialize(config);
      } else {
        logger.info('Running in live mode.');
      }

      scope.unbind(ApiOptionsToken);
      scope.unbind(UrlBuilderOptionsToken);
    },
  );
}

function initializeWithJwt10(scope: Container, configuration: ConfigurationWithJwt10, model?: PageModel) {
  const logger = scope.get(Logger);

  logger.info('Enabled token-based setup.');
  logger.info('Using Page Model API 1.0.');

  const authorizationParameter = configuration.authorizationQueryParameter ?? DEFAULT_AUTHORIZATION_PARAMETER;
  const endpointParameter = configuration.endpointQueryParameter ?? '';
  const serverIdParameter = configuration.serverIdQueryParameter ?? DEFAULT_SERVER_ID_PARAMETER;
  const { url: path, searchParams } = extractSearchParams(
    configuration.path ?? configuration.request?.path ?? '/',
    [authorizationParameter, serverIdParameter, endpointParameter].filter(Boolean),
  );
  const authorizationToken = searchParams.get(authorizationParameter) ?? undefined;
  const endpoint = searchParams.get(endpointParameter) ?? undefined;
  const serverId = searchParams.get(serverIdParameter) ?? undefined;
  const config = {
    ...configuration,
    apiVersion: '1.0',
    endpoint: configuration.endpoint ?? endpoint,
    baseUrl: appendSearchParams(configuration.baseUrl ?? '', searchParams),
    origin: configuration.origin ?? parseUrl(configuration.endpoint ?? endpoint ?? '').origin,
  };

  if (authorizationToken) {
    logger.debug('Token:', authorizationToken);
  }

  if (serverId) {
    logger.debug('Server Id:', serverId);
  }

  logger.debug('Endpoint:', config.endpoint);
  logger.debug('Origin:', config.origin);
  logger.debug('Path:', path);
  logger.debug('Base URL:', config.baseUrl);

  scope.load(PageModule(), SpaModule(), UrlModule());
  scope.bind(ApiOptionsToken).toConstantValue({ authorizationToken, serverId, ...config });
  scope.bind(UrlBuilderOptionsToken).toConstantValue(config);

  return onReady(
    scope.get<Spa>(SpaService).initialize(model ?? path),
    (page) => {
      if (page.isPreview() && config.endpoint) {
        logger.info('Running in preview mode.');
        scope.get<PostMessage>(PostMessageService).initialize(config);
        scope.get<Cms>(CmsService).initialize(config);
      } else {
        logger.info('Running in live mode.');
      }

      scope.unbind(ApiOptionsToken);
      scope.unbind(UrlBuilderOptionsToken);
    },
  );
}

/**
 * Initializes the page model.
 *
 * @param configuration Configuration of the SPA integration with brXM.
 * @param model Preloaded page model.
 */
export function initialize(configuration: Configuration, model: Page | PageModel): Page;

/**
 * Initializes the page model.
 *
 * @param configuration Configuration of the SPA integration with brXM.
 */
export async function initialize(configuration: Configuration): Promise<Page>;

export function initialize(configuration: Configuration, model?: Page | PageModel): Page | Promise<Page> {
  if (isPage(model)) {
    return model;
  }

  const scope = container.createChild();
  const logger = scope.get(Logger);

  logger.level = configuration.debug ? Level.Debug : Level.Error;
  logger.debug('Configuration:', configuration);

  return onReady(
    isConfigurationWithProxy(configuration) ? initializeWithProxy(scope, configuration, model) :
    isConfigurationWithJwt09(configuration) ? initializeWithJwt09(scope, configuration, model) :
    initializeWithJwt10(scope, configuration, model),
    (page) => {
      pages.set(page, scope);
      configuration.request?.emit?.('br:spa:initialized', page);
    },
  );
}

/**
 * Destroys the integration with the SPA page.
 * @param page Page instance to destroy.
 */
export function destroy(page: Page): void {
  const scope = pages.get(page);
  pages.delete(page);

  return scope?.get<Spa>(SpaService).destroy();
}

export { Configuration } from './configuration';
export {
  Component,
  ContainerItem,
  Container,
  Content,
  Document,
  ImageSet,
  Image,
  Link,
  ManageContentButton,
  MenuItem,
  Menu,
  MetaCollection,
  MetaComment,
  Meta,
  PageModel,
  Page,
  PaginationItem,
  Pagination,
  Reference,
  isComponent,
  isContainerItem,
  isContainer,
  isContent,
  isDocument,
  isImageSet,
  isLink,
  isMenu,
  isMetaComment,
  isMeta,
  isPage,
  isPagination,
  isReference,
  META_POSITION_BEGIN,
  META_POSITION_END,
  TYPE_CONTAINER_BOX,
  TYPE_CONTAINER_INLINE,
  TYPE_CONTAINER_NO_MARKUP,
  TYPE_CONTAINER_ORDERED_LIST,
  TYPE_CONTAINER_UNORDERED_LIST,
  TYPE_CONTAINER_ITEM_UNDEFINED,
  TYPE_LINK_EXTERNAL,
  TYPE_LINK_INTERNAL,
  TYPE_LINK_RESOURCE,
  TYPE_MANAGE_CONTENT_BUTTON,
  TYPE_MANAGE_MENU_BUTTON,
} from './page';
