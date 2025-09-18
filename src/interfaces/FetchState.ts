export interface FetchState {
    totalFolders: number;
    processedFolders: number;
    successes: number;
    failures: number;
    totalMails: number;
    errors: Error[];
}
