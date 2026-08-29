export type MemorySettings = {
  enableMemory: boolean;
  nickname: string;
  occupation: string;
  moreAboutYou: string;
};

export type MemorySummarySection = {
  id: string;
  title: string;
  body: string;
};

export type MemorySummaryStatus = 'generating' | 'generated' | 'failed';
