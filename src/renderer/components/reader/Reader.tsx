// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as path from "path";
import * as queryString from "query-string";
import * as React from "react";
import { connect } from "react-redux";
import { ReaderConfig as ReadiumCSS } from "readium-desktop/common/models/reader";
import { dialogActions, readerActions } from "readium-desktop/common/redux/actions";
import { setLocale } from "readium-desktop/common/redux/actions/i18n";
import { LocatorView } from "readium-desktop/common/views/locator";
import { TPublicationApiGet_result } from "readium-desktop/main/api/publication";
import { TReaderApiFindBookmarks_result } from "readium-desktop/main/api/reader";
import {
    _APP_NAME, _APP_VERSION, _NODE_MODULE_RELATIVE_URL, _PACKAGING, _RENDERER_READER_BASE_URL,
} from "readium-desktop/preprocessor-directives";
import { apiAction } from "readium-desktop/renderer/apiAction";
import { apiSubscribe } from "readium-desktop/renderer/apiSubscribe";
import * as styles from "readium-desktop/renderer/assets/styles/reader-app.css";
import ReaderFooter from "readium-desktop/renderer/components/reader/ReaderFooter";
import ReaderHeader from "readium-desktop/renderer/components/reader/ReaderHeader";
import SkipLink from "readium-desktop/renderer/components/utils/SkipLink";
import { diRendererGet, lazyInject } from "readium-desktop/renderer/di";
import { diRendererSymbolTable } from "readium-desktop/renderer/diSymbolTable";
import { RootState } from "readium-desktop/renderer/redux/states";
import { TDispatch } from "readium-desktop/typings/redux";
import { Store, Unsubscribe } from "redux";
import { JSON as TAJSON } from "ta-json-x";

import {
    IEventPayload_R2_EVENT_READIUMCSS, IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN,
} from "@r2-navigator-js/electron/common/events";
import {
    colCountEnum, IReadiumCSS, readiumCSSDefaults, textAlignEnum,
} from "@r2-navigator-js/electron/common/readium-css-settings";
import {
    convertCustomSchemeToHttpUrl, READIUM2_ELECTRON_HTTP_PROTOCOL,
} from "@r2-navigator-js/electron/common/sessions";
import { getURLQueryParams } from "@r2-navigator-js/electron/renderer/common/querystring";
import {
    getCurrentReadingLocation, handleLinkLocator, handleLinkUrl, installNavigatorDOM,
    isLocatorVisible, LocatorExtended, navLeftOrRight, readiumCssOnOff, setEpubReadingSystemInfo,
    setKeyDownEventHandler, setReadingLocationSaver, setReadiumCssJsonGetter,
    ttsListen, ttsNext, ttsPause, ttsPlay, ttsPrevious, ttsResume,
    TTSStateEnum, ttsStop,
} from "@r2-navigator-js/electron/renderer/index";
import { Locator } from "@r2-shared-js/models/locator";
import { Publication as R2Publication } from "@r2-shared-js/models/publication";

import { TranslatorProps, withTranslator } from "../utils/hoc/translator";
import optionsValues from "./options-values";

import * as classNames from "classnames";

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();
// import { webFrame } from "electron";
// webFrame.registerURLSchemeAsSecure(READIUM2_ELECTRON_HTTP_PROTOCOL);
// webFrame.registerURLSchemeAsPrivileged(READIUM2_ELECTRON_HTTP_PROTOCOL, {
//     allowServiceWorkers: false,
//     bypassCSP: false,
//     corsEnabled: true,
//     secure: true,
//     supportFetchAPI: true,
// });

/**
 * WHY lot of const variable not in constructor ?
 */
const queryParams = getURLQueryParams();

// TODO: centralize this code, currently duplicated
// see src/main/streamer.js
const computeReadiumCssJsonMessage = (): IEventPayload_R2_EVENT_READIUMCSS => {
    const store = diRendererGet("store");
    let settings = store.getState().reader.config;
    if (settings.value) {
        settings = settings.value;
    }

    // TODO: see the readiumCSSDefaults values below, replace with readium-desktop's own
    const cssJson: IReadiumCSS = {

        a11yNormalize: readiumCSSDefaults.a11yNormalize,

        backgroundColor: readiumCSSDefaults.backgroundColor,

        bodyHyphens: readiumCSSDefaults.bodyHyphens,

        colCount: settings.colCount === "1" ? colCountEnum.one :
            (settings.colCount === "2" ? colCountEnum.two : colCountEnum.auto),

        darken: settings.darken,

        font: settings.font,

        fontSize: settings.fontSize,

        invert: settings.invert,

        letterSpacing: settings.letterSpacing,

        ligatures: readiumCSSDefaults.ligatures,

        lineHeight: settings.lineHeight,

        night: settings.night,

        pageMargins: settings.pageMargins,

        paged: settings.paged,

        paraIndent: readiumCSSDefaults.paraIndent,

        paraSpacing: settings.paraSpacing,

        sepia: settings.sepia,

        noFootnotes: settings.noFootnotes,

        // warning I have modified the test condition to works with the type align
        textAlign: settings.align === "left" ? textAlignEnum.left :
            (settings.align === "right" ? textAlignEnum.right :
            (settings.align === "justify" ? textAlignEnum.justify : textAlignEnum.start)),

        textColor: readiumCSSDefaults.textColor,

        typeScale: readiumCSSDefaults.typeScale,

        wordSpacing: settings.wordSpacing,

        reduceMotion: readiumCSSDefaults.reduceMotion,
    };
    const jsonMsg: IEventPayload_R2_EVENT_READIUMCSS = { setCSS: cssJson };
    return jsonMsg;
};
setReadiumCssJsonGetter(computeReadiumCssJsonMessage);

const publicationJsonUrl = queryParams.pub.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) ?
    convertCustomSchemeToHttpUrl(queryParams.pub) : queryParams.pub;
// const pathBase64Raw = publicationJsonUrl.replace(/.*\/pub\/(.*)\/manifest.json/, "$1");
// const pathBase64 = decodeURIComponent(pathBase64Raw);
// const pathDecoded = window.atob(pathBase64);
// const pathFileName = pathDecoded.substr(
//     pathDecoded.replace(/\\/g, "/").lastIndexOf("/") + 1,
//     pathDecoded.length - 1);

const lcpHint = queryParams.lcpHint;

interface IProps extends TranslatorProps, ReturnType<typeof mapStateToProps>, ReturnType<typeof mapDispatchToProps> {
    /*
    reader?: any;
    mode?: any;
    infoOpen?: boolean;
    deleteBookmark?: TReaderApiDeleteBookmark;
    addBookmark?: TReaderApiAddBookmark;
    findBookmarks: TReaderApiFindBookmarks;
    toggleFullscreen?: any;
    closeReader?: any;
    detachReader?: any;
    setLastReadingLocation: TReaderApiSetLastReadingLocation;
    bookmarks?: TReaderApiFindBookmarks_result;
    displayPublicationInfo?: any;
    publication?: TPublicationApiGet_result;
    */
}

interface IState {
    publicationJsonUrl?: string;
    lcpHint?: string;
    title?: string;
    lcpPass?: string;
    contentTableOpen: boolean;
    settingsOpen: boolean;
    settingsValues: ReadiumCSS;
    shortcutEnable: boolean;
    landmarksOpen: boolean;
    landmarkTabOpen: number;
    publicationData: R2Publication | undefined;
    publicationInfo: TPublicationApiGet_result | undefined;
    menuOpen: boolean;
    fullscreen: boolean;
    ttsState: TTSStateEnum;
    indexes: any;
    visibleBookmarkList: LocatorView[];
    currentLocation: LocatorExtended;
    bookmarks: TReaderApiFindBookmarks_result | undefined;
}

// WHY ??
const defaultLocale = "fr";

export class Reader extends React.Component<IProps & ReturnType<typeof mapDispatchToProps>, IState> {
    private fastLinkRef: any;

    // can be get back with redux-connect props injection
    // to remove
    @lazyInject(diRendererSymbolTable.store)
    private store: Store<RootState>;

    // can be get back with withTranslator HOC
    // to remove
    // @lazyInject(diRendererSymbolTable.translator)
    // private translator: Translator;

    private pubId: string;
    private unsubscribe: Unsubscribe;

    constructor(props: any) {
        super(props);

        // WHY is it sync in init.ts, no ??
        const locale = this.store.getState().i18n.locale;

        if (locale == null) {
            this.store.dispatch(setLocale(defaultLocale));
        }


        this.state = {
            publicationJsonUrl: "HTTP://URL",
            lcpHint: "LCP hint",
            title: "TITLE",
            lcpPass: "LCP pass",
            contentTableOpen: false,
            settingsOpen: false,
            settingsValues: {
                align: "left",
                colCount: "auto",
                dark: false,
                font: "DEFAULT",
                fontSize: "100%",
                invert: false,
                lineHeight: undefined,
                night: false,
                paged: false,
                readiumcss: true,
                sepia: false,
                wordSpacing: undefined,
                paraSpacing: undefined,
                letterSpacing: undefined,
                pageMargins: undefined,
            },
            shortcutEnable: true,
            indexes: {
                fontSize: 3, pageMargins: 0, wordSpacing: 0, letterSpacing: 0, paraSpacing: 0,
            },
            landmarksOpen: false,
            landmarkTabOpen: 0,
            publicationData: undefined,
            publicationInfo: undefined,
            menuOpen: false,
            fullscreen: false,
            ttsState: TTSStateEnum.STOPPED,
            visibleBookmarkList: [],
            currentLocation: undefined,
            bookmarks: undefined,
        };

        ttsListen((ttsstater: TTSStateEnum) => {
            console.log(ttsstater);
            this.setState({ttsState: ttsstater});
        });

        this.pubId = queryString.parse(location.search).pubId as string;

        this.handleAudioClick = this.handleAudioClick.bind(this);
        this.handlePauseClick = this.handlePauseClick.bind(this);
        this.handleStopClick = this.handleStopClick.bind(this);
        this.handlePlayClick = this.handlePlayClick.bind(this);
        this.handleSkipPreviousClick = this.handleSkipPreviousClick.bind(this);
        this.handleSkipNextClick = this.handleSkipNextClick.bind(this);
        this.handleMenuButtonClick = this.handleMenuButtonClick.bind(this);
        this.handleSettingsClick = this.handleSettingsClick.bind(this);
        this.handleFullscreenClick = this.handleFullscreenClick.bind(this);
        this.handleReaderClose = this.handleReaderClose.bind(this);
        this.handleReaderDetach = this.handleReaderDetach.bind(this);
        this.setSettings = this.setSettings.bind(this);
        this.handleReadingLocationChange = this.handleReadingLocationChange.bind(this);
        this.handleToggleBookmark = this.handleToggleBookmark.bind(this);
        this.goToLocator = this.goToLocator.bind(this);
        this.handleLinkClick = this.handleLinkClick.bind(this);
        this.findBookmarks = this.findBookmarks.bind(this);
        this.displayPublicationInfo = this.displayPublicationInfo.bind(this);
    }

    public async componentDidMount() {
        // queryParams.focusInside
        const focusInside = queryString.parse(location.search).focusInside === "true";
        if (focusInside) {
            this.fastLinkRef.focus();
        }

        this.setState({
            publicationJsonUrl,
        });

        if (lcpHint) {
            this.setState({
                lcpHint,
                lcpPass: this.state.lcpPass + " [" + lcpHint + "]",
            });
        }

        // What is the point of this redux store subscribe ?
        // the locale is already set
        // Why an adaptation from redux settings to local state ?
        this.store.subscribe(() => {
            const storeState = this.store.getState();
            this.props.translator.setLocale(storeState.i18n.locale);
            const settings = storeState.reader.config.value;
            if (settings && settings !== this.state.settingsValues) {
                this.props.translator.setLocale(this.store.getState().i18n.locale);

                const indexes = this.state.indexes;
                for (const name of Object.keys(this.state.indexes)) {
                    let i = 0;
                    for (const value of optionsValues[name]) {
                        if (settings[name] === value) {
                            indexes[name] = i;
                        }
                        i++;
                    }
                }

                this.setState({settingsValues: settings, indexes});

                // this.state.publication is initialized in loadPublicationIntoViewport(),
                // which calls installNavigatorDOM() which in turn allows navigator API functions to be called safely
                if (this.state.publicationData) {
                    // Push reader config to navigator
                    readiumCssOnOff();
                }
            }
        });

        window.document.documentElement.addEventListener("keydown", (_ev: KeyboardEvent) => {
            window.document.documentElement.classList.add("R2_CSS_CLASS__KEYBOARD_INTERACT");
        }, true);
        window.document.documentElement.addEventListener("mousedown", (_ev: MouseEvent) => {
            window.document.documentElement.classList.remove("R2_CSS_CLASS__KEYBOARD_INTERACT");
        }, true);

        // TODO: this is a short-term hack.
        // Can we instead subscribe to Redux action type == ActionType.CloseRequest,
        // but narrow it down specically to a reader window instance (not application-wide)
        window.document.addEventListener("Thorium:DialogClose", (_ev: Event) => {
            this.setState({
                shortcutEnable: true,
            });
        });

        let docHref: string = queryParams.docHref;
        let docSelector: string = queryParams.docSelector;

        if (docHref && docSelector) {
            // Decode base64
            docHref = window.atob(docHref);
            docSelector = window.atob(docSelector);
        }

        // Note that CFI, etc. can optionally be restored too,
        // but navigator currently uses cssSelector as the primary
        const locator: Locator = {
            href: docHref,
            locations: {
                cfi: undefined,
                cssSelector: docSelector,
                position: undefined,
                progression: undefined,
            },
        };

        const publication = await this.loadPublicationIntoViewport(locator);
        this.setState({publicationData: publication});

        const keyDownEventHandler = (ev: IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN) => {
            // DEPRECATED
            // if (ev.keyCode === 37 || ev.keyCode === 39) { // left / right
            // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
            // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
            // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
            const leftKey = ev.code === "ArrowLeft";
            const rightKey = ev.code === "ArrowRight";
            if (leftKey || rightKey) {
                const noModifierKeys = !ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey;
                const spineNavModifierKeys = process.platform === "darwin" ? ev.ctrlKey && ev.shiftKey :
                    ev.ctrlKey && ev.shiftKey && ev.altKey;
                if (noModifierKeys || spineNavModifierKeys) {
                    navLeftOrRight(leftKey, spineNavModifierKeys);
                    if (spineNavModifierKeys) {
                        if (this.fastLinkRef) {
                            setTimeout(() => {
                                if (this.fastLinkRef) {
                                    this.fastLinkRef.focus();
                                }
                            }, 200);
                        }
                    }
                }
            }
        };
        setKeyDownEventHandler(keyDownEventHandler);
        window.document.addEventListener("keydown", (ev: KeyboardEvent) => {
            if (this.state.shortcutEnable) {
                keyDownEventHandler(ev);
            }
        });

        setReadingLocationSaver(this.handleReadingLocationChange);

        setEpubReadingSystemInfo({ name: _APP_NAME, version: _APP_VERSION });

        this.unsubscribe = apiSubscribe([
            "reader/deleteBookmark",
            "reader/addBookmark",
        ], this.findBookmarks);

        apiAction("publication/get", queryParams.pubId)
            .then((publicationInfo) => this.setState({publicationInfo}))
            .catch((error) => console.error("Error to fetch api publication/get", error));
    }

    public setTTSState(newTtsState: TTSStateEnum) {
        console.log("set tts state was called");
        this.setState({ttsState : newTtsState});
    }

    public async componentDidUpdate(_oldProps: IProps, oldState: IState) {
        if (oldState.bookmarks !== this.state.bookmarks) {
            await this.checkBookmarks();
        }
    }

    public componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    public render(): React.ReactElement<{}> {
        const readerMenuProps = {
            open: this.state.menuOpen,
            publication: this.state.publicationData,
            handleLinkClick: this.handleLinkClick,
            handleBookmarkClick: this.goToLocator,
            toggleMenu: this.handleMenuButtonClick,
        };

        const readerOptionsProps = {
            open: this.state.settingsOpen,
            indexes: this.state.indexes,
            settings: this.state.settingsValues,
            handleSettingChange: this.handleSettingsValueChange.bind(this),
            handleIndexChange: this.handleIndexValueChange.bind(this),
            setSettings: this.setSettings,
            toggleMenu: this.handleSettingsClick,
        };

        return (
                <div>
                    <SkipLink
                        className={styles.skip_link}
                        anchorId="main-content"
                        label={this.props.__("accessibility.skipLink")}
                    />
                    <div className={classNames(
                        styles.root,
                        this.state.settingsValues.night && styles.nightMode,
                        this.state.settingsValues.sepia && styles.sepiaMode,
                    )}>
                        <ReaderHeader
                            infoOpen={this.props.infoOpen}
                            menuOpen={this.state.menuOpen}
                            settingsOpen={this.state.settingsOpen}
                            handleAudioClick={this.handleAudioClick}
                            handlePlayClick={this.handlePlayClick}
                            handleStopClick={this.handleStopClick}
                            handleSkipPreviousClick={this.handleSkipPreviousClick}
                            handleSkipNextClick={this.handleSkipNextClick}
                            handlePauseClick={this.handlePauseClick}
                            handleMenuClick={this.handleMenuButtonClick}
                            handleSettingsClick={this.handleSettingsClick}
                            fullscreen={this.state.fullscreen}
                            mode={this.props.mode}
                            handleFullscreenClick={this.handleFullscreenClick}
                            handleReaderDetach={this.handleReaderDetach}
                            handleReaderClose={this.handleReaderClose}
                            toggleBookmark={ this.handleToggleBookmark }
                            ttsState={this.state.ttsState}
                            isOnBookmark={this.state.visibleBookmarkList.length > 0}
                            readerOptionsProps={readerOptionsProps}
                            readerMenuProps={readerMenuProps}
                            displayPublicationInfo={this.displayPublicationInfo}
                        />
                        <div className={styles.content_root}>
                            <div className={styles.reader}>
                                <main
                                    id="main"
                                    role="main"
                                    className={styles.publication_viewport_container}>
                                    <a ref={(ref) => this.fastLinkRef = ref}
                                        id="main-content"
                                        aria-hidden tabIndex={-1}></a>
                                    <div id="publication_viewport" className={styles.publication_viewport}> </div>
                                </main>
                            </div>
                        </div>
                        <ReaderFooter
                            navLeftOrRight={navLeftOrRight}
                            fullscreen={this.state.fullscreen}
                            currentLocation={this.state.currentLocation}
                            publication={this.state.publicationData}
                            handleLinkClick={this.handleLinkClick}
                        />
                    </div>
                </div>
        );
    }

    private displayPublicationInfo() {
        if (this.state.publicationInfo) {
            // TODO: subscribe to Redux action type == ActionType.CloseRequest
            // in order to reset shortcutEnable to true? Problem: must be specific to this reader window.
            // So instead we subscribe to DOM event "Thorium:DialogClose", but this is a short-term hack!
            this.setState({
                shortcutEnable: false,
            });
            this.props.displayPublicationInfo(this.state.publicationInfo.identifier);
        }
    }

    private goToLocator(locator: Locator) {
        handleLinkLocator(locator);
    }

    private async loadPublicationIntoViewport(locator: Locator): Promise<R2Publication> {
        let response: Response;
        try {
            // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webframe
            // queryParams.pub is READIUM2_ELECTRON_HTTP_PROTOCOL (see convertCustomSchemeToHttpUrl)
            // publicationJsonUrl is https://127.0.0.1:PORT
            response = await fetch(publicationJsonUrl);
        } catch (e) {
            return Promise.reject(e);
        }
        if (!response.ok) {
            console.log("BAD RESPONSE?!");
        }

        let publicationJSON: any | undefined;
        try {
            publicationJSON = await response.json();
        } catch (e) {
            console.log(e);
            return Promise.reject(e);
        }
        if (!publicationJSON) {
            return Promise.reject("!publicationJSON");
        }
        const publication = TAJSON.deserialize<R2Publication>(publicationJSON, R2Publication);

        if (publication.Metadata && publication.Metadata.Title) {
            const title = this.props.translator.translateContentField(publication.Metadata.Title);

            if (title) {
                window.document.title = "Thorium - " + title;
                this.setState({
                    title,
                });
            }
        }

        let preloadPath = "preload.js";
        if (_PACKAGING === "1") {
            preloadPath = "file://" + path.normalize(path.join((global as any).__dirname, preloadPath));
        } else {
            preloadPath = "r2-navigator-js/dist/" +
            "es6-es2015" +
            "/src/electron/renderer/webview/preload.js";

            if (_RENDERER_READER_BASE_URL === "file://") {
                // dist/prod mode (without WebPack HMR Hot Module Reload HTTP server)
                preloadPath = "file://" +
                    path.normalize(path.join((global as any).__dirname, _NODE_MODULE_RELATIVE_URL, preloadPath));
            } else {
                // dev/debug mode (with WebPack HMR Hot Module Reload HTTP server)
                preloadPath = "file://" + path.normalize(path.join(process.cwd(), "node_modules", preloadPath));
            }
        }

        preloadPath = preloadPath.replace(/\\/g, "/");

        installNavigatorDOM(
            publication as any,
            publicationJsonUrl,
            "publication_viewport",
            preloadPath,
            locator,
            true,
        );

        return publication;
    }

    private handleMenuButtonClick() {
        this.setState({
            menuOpen: !this.state.menuOpen,
            shortcutEnable: this.state.menuOpen,
            settingsOpen: false,
        });
    }

    private saveReadingLocation(loc: LocatorExtended) {
//        this.props.setLastReadingLocation(queryParams.pubId, loc.locator);
        apiAction("reader/setLastReadingLocation", queryParams.pubId, loc.locator)
            .catch((error) => console.error("Error to fetch api reader/setLastReadingLocation", error));

    }

    private async handleReadingLocationChange(loc: LocatorExtended) {
        this.findBookmarks();
        this.saveReadingLocation(loc);
        this.setState({currentLocation: getCurrentReadingLocation()});
        // No need to explicitly refresh the bookmarks status here,
        // as componentDidUpdate() will call the function after setState():
        // await this.checkBookmarks();
    }

    // check if a bookmark is on the screen
    private async checkBookmarks() {
        if (!this.state.bookmarks) {
            return;
        }

        // this.state.publication is initialized in loadPublicationIntoViewport(),
        // which calls installNavigatorDOM() which in turn allows navigator API functions to be called safely
        if (!this.state.publicationData) {
            return;
        }

        const locator = this.state.currentLocation ? this.state.currentLocation.locator : undefined;

        const visibleBookmarkList = [];
        for (const bookmark of this.state.bookmarks) {
            // calling into the webview via IPC is expensive,
            // let's filter out ahead of time based on document href
            if (!locator || locator.href === bookmark.locator.href) {
                const isVisible = await isLocatorVisible(bookmark.locator);
                if ( isVisible ) {
                    visibleBookmarkList.push(bookmark);
                }
            }
        }
        this.setState({visibleBookmarkList});
    }

    private handleLinkClick(event: any, url: string) {
        if (event) {
            event.preventDefault();
        }
        if (!url) {
            return;
        }

        // DEPRECATED
        // event.charCode === 13
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/charCode
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
        // alternatively, could also use event.code === "Enter"
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
        // if (event && event.key === "Enter") {
        // }
        // Screen readers have their own shortcut to activate hyperlinks (e.g. VoiceOver CTRL+OPT+SPACE),
        // so we must not limit the focus behaviour to app-defined keyboard interaction (i.e. ENTER key)
        // (note that this means the focus is moved even when TOC items clicked with mouse, which is fine)
        if (this.fastLinkRef) {
            setTimeout(() => {
                if (this.fastLinkRef) {
                    this.fastLinkRef.focus();
                }
            }, 200);
        }

        if (this.state.menuOpen) {
            setTimeout(() => {
                this.handleMenuButtonClick();
            }, 100);
        }

        const newUrl = publicationJsonUrl + "/../" + url;
        handleLinkUrl(newUrl);

        // Example to pass a specific cssSelector:
        // (for example to restore a bookmark)
        // const locator: Locator = {
        //     href: url,
        //     locations: {
        //         cfi: undefined,
        //         cssSelector: CSSSELECTOR,
        //         position: undefined,
        //         progression: undefined,
        //     }
        // };
        // handleLinkLocator(locator);

        // Example to save a bookmark:
        // const loc: LocatorExtended = getCurrentReadingLocation();
        // Note: there is additional useful info about pagination
        // which can be used to report progress info to the user
        // if (loc.paginationInfo !== null) =>
        // loc.paginationInfo.totalColumns (N = 1+)
        // loc.paginationInfo.currentColumn [0, (N-1)]
        // loc.paginationInfo.isTwoPageSpread (true|false)
        // loc.paginationInfo.spreadIndex [0, (N/2)]
    }

    private async handleToggleBookmark() {
        await this.checkBookmarks();
        if (this.state.visibleBookmarkList.length > 0) {
            for (const bookmark of this.state.visibleBookmarkList) {
//                this.props.deleteBookmark(bookmark.identifier);
                try {
                    await apiAction("reader/deleteBookmark", bookmark.identifier);
                } catch (e) {
                    console.error("Error to fetch api reader/deleteBookmark", e);
                }
            }
        } else if (this.state.currentLocation) {
            const locator = this.state.currentLocation.locator;
//            this.props.addBookmark(this.pubId, locator);
            try {
                await apiAction("reader/addBookmark", this.pubId, locator);
            } catch (e) {
                console.error("Error to fetch api reader/addBookmark", e);
            }
        }
    }

    private handleReaderClose() {
        this.props.closeReader(this.props.reader);
    }

    private handleReaderDetach() {
        this.props.detachReader(this.props.reader);
    }

    private handleFullscreenClick() {
        this.props.toggleFullscreen(!this.state.fullscreen);
        this.setState({fullscreen: !this.state.fullscreen});
    }

    private handleSettingsClick() {
        this.setState({
            settingsOpen: !this.state.settingsOpen,
            shortcutEnable: this.state.settingsOpen,
            menuOpen: false,
        });
    }

    private handleAudioClick() {
        ttsPlay();
    }
    private handlePauseClick() {
        ttsPause();
    }
    private handleStopClick() {
        ttsStop();
    }
    private handlePlayClick() {
        ttsResume();
    }
    private handleSkipNextClick() {
        ttsNext();
    }
    private handleSkipPreviousClick() {
        ttsPrevious();
    }

    private handleSettingsSave() {
        const values = this.state.settingsValues;

        this.store.dispatch(readerActions.setConfig(values));
        // Push reader config to navigator
        readiumCssOnOff();
    }

    private handleSettingsValueChange(event: any, name: string, givenValue?: any) {
        if ((givenValue === null || givenValue === undefined) && !event) {
            return;
        }

        const settingsValues = this.state.settingsValues;
        let value = givenValue;

        if (givenValue === null || givenValue === undefined) {
            value = event.target.value.toString();
        }

        if (value === "false") {
            value = false;
        } else if (value === "true") {
            value = true;
        }

        settingsValues[name] =  value;

        this.setState({settingsValues});

        this.handleSettingsSave();
    }

    private handleIndexValueChange(event: any, name: string) {
        const indexes = this.state.indexes;
        const settingsValues = this.state.settingsValues;

        const value = event.target.value.toString();

        indexes[name] =  value;
        this.setState({ indexes });

        settingsValues[name] = optionsValues[name][value];
        this.setState({ settingsValues });

        this.handleSettingsSave();
    }

    private setSettings(settingsValues: ReadiumCSS) {
        if (!settingsValues) {
            return;
        }

        this.setState({ settingsValues });
        this.handleSettingsSave();
    }

    private findBookmarks() {
        apiAction("reader/findBookmarks", this.pubId)
            .then((bookmarks) => this.setState({bookmarks}))
            .catch((error) => console.error("Error to fetch api reader/findBookmarks", error));
    }
}

/*
const buildBookmarkRequestData = () => {
    return [ queryString.parse(location.search).pubId as string ];
};
*/

const mapStateToProps = (state: RootState, __: any) => {
    return {
        reader: state.reader.reader,
        mode: state.reader.mode,
        infoOpen: state.dialog.open &&
        state.dialog.type === "publication-info-reader",
    };
};

const mapDispatchToProps = (dispatch: TDispatch) => {
    return {
        toggleFullscreen: (fullscreenOn: boolean) => {
            if (fullscreenOn) {
                dispatch(readerActions.setFullscreenOn());
            } else {
                dispatch(readerActions.setFullscreenOff());
            }
        },
        closeReader: (reader: any) => {
            dispatch(readerActions.close(reader, true));
        },
        detachReader: (reader: any) => {
            dispatch(readerActions.detach(reader));
        },
        displayPublicationInfo: (pubId: string) => {
            dispatch(dialogActions.open("publication-info-reader",
                {
                    publicationIdentifier: pubId,
                    opdsPublication: undefined,
                },
            ));
        },
    };
};

/*
const buildRequestData = (_props: ReaderProps) => {
    return [ queryParams.pubId ];
};
*/

export default connect(mapStateToProps, mapDispatchToProps)(withTranslator(Reader));
