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
import { BrProps } from '@bloomreach/react-sdk';

export function Banner(props: BrProps) {
  const { document: documentRef } = props.component.getModels();
  const document = documentRef && props.page.getContent(documentRef);

  if (!document) {
    return <div/>;
  }

  // TODO: Implement link generation mechanism
  const { content, image: imageRef, link: linkRef, title } = document.getData<DocumentData>();
  const image = imageRef && props.page.getContent(imageRef);
  const link = linkRef && props.page.getContent(linkRef);

  return (
    <div className="jumbotron mb-3">
      { title && <h1>{title}</h1>}
      { image && <img className="img-fluid" src={image.getData()._links.site.href} alt={title} /> }
      { content && <div dangerouslySetInnerHTML={{ __html: content.value }} /> }
      { link && (
        <p className="lead">
          <a className="btn btn-primary btn-lg" href={link.getData()._links.site.href} role="button">Learn more</a>
        </p>
      ) }
    </div>
  );
}
