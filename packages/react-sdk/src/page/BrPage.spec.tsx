/*
 * Copyright 2019 Hippo B.V. (http://www.onehippo.com)
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

import React from 'react';
import { mocked } from 'ts-jest/utils';
import { mount, shallow, ShallowWrapper } from 'enzyme';
import { destroy, initialize, Page } from '@bloomreach/spa-sdk';
import { BrPage } from './BrPage';
import { Meta } from '../meta';

jest.mock('@bloomreach/spa-sdk');

class TestComponent extends React.Component {}

const config = {
  httpClient: jest.fn(),
  request: { path: '/' },
  options: {
    live: {
      pageModelBaseUrl: 'http://localhost:8080/site/my-spa/resourceapi',
    },
    preview: {
      pageModelBaseUrl: 'http://localhost:8080/site/_cmsinternal/my-spa/resourceapi',
      spaBasePath: '/site/_cmsinternal/my-spa',
    },
  },
};
const mapping = { TestComponent };

describe('BrPage', () => {
  const children = <div/>;
  let wrapper: ShallowWrapper<React.ComponentProps<typeof BrPage>, { page?: Page }> ;

  beforeEach(() => {
    jest.clearAllMocks();

    wrapper = shallow(<BrPage configuration={config} mapping={mapping}>{children}</BrPage>);
  });

  it('should initialize the SPA SDK and sync the CMS', () => {
    expect(initialize).toHaveBeenCalledWith(config);

    const page = wrapper.state('page');
    expect(page).toBeDefined();
    expect(page!.sync).toHaveBeenCalled();
  });

  it('should render nothing if there is no page', () => {
    wrapper.setState({ page: undefined });

    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('should render nothing if there is an error loading the page', async () => {
    const error = new Error('error-loading-page');
    mocked(initialize).mockRejectedValueOnce(error);

    const setState = jest.spyOn(BrPage.prototype, 'setState')
      .mockImplementationOnce(() => {});

    mount(<BrPage configuration={config} mapping={mapping} />);
    await new Promise(process.nextTick);

    expect(setState).toHaveBeenCalledWith(expect.any(Function));
    expect(setState.mock.calls[0][0]).toThrowError(error);
  });

  it('should render BrPageContext.provider', () => {
    const page = wrapper.state('page')!;
    expect(wrapper.find('ContextProvider').first().prop('value')).toEqual(page);
  });

  it('should render MappingContext.provider', () => {
    expect(wrapper.find('ContextProvider').last().prop('value')).toEqual(mapping);
  });

  it('should render children', () => {
    expect(wrapper.contains(children)).toBe(true);
  });

  it('should render meta data in comments', () => {
    const page = wrapper.state('page')!;
    const [beginMeta, endMeta] = page.getComponent()!.getMeta();

    expect(wrapper.contains(<Meta meta={beginMeta} />)).toBe(true);
    expect(wrapper.contains(<Meta meta={endMeta} />)).toBe(true);
  });

  it('should update page and sync CMS when configuration changes', async () => {
    const page = wrapper.state('page')!;
    const configuration = { ...config };
    wrapper.setProps({ configuration });

    expect(destroy).toHaveBeenCalledWith(page);
    expect(initialize).toHaveBeenCalledWith(configuration);
    expect(page.sync).toHaveBeenCalled();
  });

  it('should destroy the page when unmounting', async () => {
    const page = wrapper.state('page')!;

    wrapper.unmount();
    expect(destroy).toHaveBeenCalledWith(page);
  });

  it('should not destroy an empty page when unmounting', async () => {
    wrapper.setState({ page: undefined });

    wrapper.unmount();
    expect(destroy).not.toHaveBeenCalled();
  });
});
