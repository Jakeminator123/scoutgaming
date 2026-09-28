export interface ProbeFact {id:string;topicId:string;type:'player'|'hand';content:string;source:Record<string,unknown>;createdAt:number;expiresAt:number;notBefore:number}
export interface ProbeFixture {id:string;label:string;expected:string;context:{now:number;displayName:string;language:string;history:{role:string;text:string}[];memories:ProbeFact[];recentTopics:string[];nameAllowed:boolean;quiet:boolean}}
export function probeFixtures(now?:number):ProbeFixture[];
export function demoProbeMemories(now?:number):ProbeFact[];
