// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

export enum AppStatus {
    Unknown = "unknown",
    Initialized = "initialized",
    Error = "error",
}

export interface AppState {
    status: AppStatus;

    publicationFileLocks: { [identifier: string]: boolean };
}
