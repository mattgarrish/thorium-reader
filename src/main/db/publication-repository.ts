import { injectable} from "inversify";
import * as PouchDB from "pouchdb";

import { Publication } from "readium-desktop/models/publication";

const ID_PREFIX = "publication_";

@injectable()
export class PublicationRepository {
    private db: PouchDB.Database;

    public constructor(db: PouchDB.Database) {
        this.db = db;
    }

    public put(publication: Publication): Promise<any> {
        return this.db.put(Object.assign(
            {},
            publication,
            { _id: ID_PREFIX + publication.identifier },
        ));
    }

    public get(identifier: string): Promise<Publication> {
        return this.db
            .get(ID_PREFIX + identifier)
            .then((result: PouchDB.Core.Document<any>) => {
                return this.convertToPublication(result);
            })
            .catch((error) => {
                throw error;
            });
    }

    public getAll(): Promise<Publication[]> {
        return this.db
            .allDocs()
            .then((result: PouchDB.Core.AllDocsResponse<any>) => {
                return result.rows.map((row) => {
                    return this.convertToPublication(row);
                });
            })
            .catch((error: any) => {
                throw error;
            });
    }

    private convertToPublication(doc: PouchDB.Core.Document<any>): Publication {
        return { ...doc, _id: undefined, _rev: undefined };
    }
}
