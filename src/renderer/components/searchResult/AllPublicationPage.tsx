import * as qs from "query-string";

import * as React from "react";

import { RouteComponentProps } from "react-router-dom";

import { withApi } from "readium-desktop/renderer/components/utils/api";

import { TranslatorProps } from "readium-desktop/renderer/components/utils/translator";

import LibraryLayout from "readium-desktop/renderer/components/layout/LibraryLayout";

import Header, { DisplayType } from "../catalog/Header";

import GridView from "readium-desktop/renderer/components/searchResult/GridView";
import ListView from "readium-desktop/renderer/components/searchResult/ListView";

import { Publication } from "readium-desktop/common/models/publication";

import BreadCrumb from "readium-desktop/renderer/components/layout/BreadCrumb";

interface AllPublicationPageProps extends TranslatorProps, RouteComponentProps {
    publications?: Publication[];
}

export class AllPublicationPage extends React.Component<AllPublicationPageProps, undefined> {
    public render(): React.ReactElement<{}> {
        let DisplayView: any = GridView;
        let displayType = DisplayType.Grid;

        const title = "Tous mes livres";

        if (this.props.location) {
            const parsedResult = qs.parse(this.props.location.search);

            if (parsedResult.displayType === DisplayType.List) {
                DisplayView = ListView;
                displayType = DisplayType.List;
            }
        }

        return (
            <LibraryLayout>
                <div>
                    <Header displayType={ displayType } />
                    <BreadCrumb
                        search={this.props.location.search}
                        breadcrumb={[{name: "Mes livres", path: "/library"}, {name: title as string}]}
                    />
                    { this.props.publications ?
                        <DisplayView publications={ this.props.publications } />
                    : <></>}
                </div>
            </LibraryLayout>
        );
    }
}

export default withApi(
    AllPublicationPage,
    {
        operations: [
            {
                moduleId: "publication",
                methodId: "findAll",
                resultProp: "publications",
                onLoad: true,
            },
        ],
        refreshTriggers: [
            {
                moduleId: "publication",
                methodId: "import",
            },
            {
                moduleId: "publication",
                methodId: "delete",
            },
            {
                moduleId: "catalog",
                methodId: "addEntry",
            },
            {
                moduleId: "publication",
                methodId: "updateTags",
            },
        ],
    },
);