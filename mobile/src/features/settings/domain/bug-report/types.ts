export type BugReportCategory =
  | 'GENERAL'
  | 'UI'
  | 'VOICE'
  | 'INTEGRATION'
  | 'PERFORMANCE';

export type BugReportDraft = {
  category?: BugReportCategory;
  description: string;
  includeScreenshot: boolean;
  screenshotUris: string[];
};

export type BugReportSubmitInput = {
  category?: BugReportCategory;
  description: string;
  context?: string;
  includeScreenshot: boolean;
  screenshotUris: string[];
};

export type BugReportResult = {
  id: string;
  status: 'received';
};

export type BugReportSupportUrls = {
  supportUrl: string;
};
