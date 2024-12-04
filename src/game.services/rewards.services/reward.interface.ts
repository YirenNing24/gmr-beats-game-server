import { Time } from "rethinkdb";


export interface CardOwned {
    name: string;
}

export interface AnimalMatch {
    name: string;
}


export interface RewardData {
    username?: string;
    type?: string;

    songName?: string;
    songRewardType?: string;

    reward?: string;
    rewardName?: string;
    
    claimed?: boolean;
    claimedAt?: string
    eligible?: boolean;


}