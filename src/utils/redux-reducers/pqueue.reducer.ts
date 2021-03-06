// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Action } from "redux";

export interface ActionWithPayload<Type = string>
    extends Action<Type> {
}

export interface IPQueueAction<TAction extends
    ActionWithPayload<ActionType>, Key = number, Value = string, ActionType = string> {
    type: ActionType;
    selector: (action: TAction) => IPQueueState<Key, Value>;
}

export interface IPQueueData
<
    TPushAction extends ActionWithPayload<ActionType>,
    TPopAction extends ActionWithPayload<ActionType>,
    Key = number,
    Value = string,
    ActionType = string,
> {
    push: IPQueueAction<TPushAction, Key, Value, ActionType>;
    pop: IPQueueAction<TPopAction, Key, Value, ActionType>;
    sortFct: (a: IPQueueState<Key, Value>, b: IPQueueState<Key, Value>) => number;
}

export type IPQueueState<Key, Value> = [Key, Value];
export type TPQueueState<K = number, V = string> = Array<IPQueueState<K, V>>;

export function priorityQueueReducer
    <
        TPushAction extends ActionWithPayload<ActionType>,
        TPopAction extends ActionWithPayload<ActionType>,
        Key = number,
        Value = string,
        ActionType = string,
    >(
        data: IPQueueData<TPushAction, TPopAction, Key, Value, ActionType>,
) {

    const reducer =
        (
                queue: TPQueueState<Key, Value>,
                action: TPopAction | TPushAction,
        ): TPQueueState<Key, Value> => {

            if (!queue || !Array.isArray(queue)) {
                queue = [];
            }

            if (action.type === data.push.type) {
                const newQueue = queue.slice();

                const selectorItem = data.push.selector(action as TPushAction);
                if (selectorItem[1]) {

                    const index = newQueue.findIndex((item) => item[1] === selectorItem[1]);
                    if (index > -1) {
                        newQueue[index] = selectorItem;
                    } else {
                        newQueue.push(selectorItem);
                    }
                    newQueue.sort(data.sortFct);

                    return newQueue;
                }

            } else if (action.type === data.pop.type) {

                const selectorItem = data.pop.selector(action as TPopAction);
                const index = queue.findIndex((item) => item[1] === selectorItem[1]);
                if (index > -1) {

                    const newQueue = queue.slice();

                    const left = newQueue.slice(0, index);
                    const right = newQueue.slice(index + 1, newQueue.length);

                    return left.concat(right);
                }
            }

            return queue;
        };

    return reducer;
}
