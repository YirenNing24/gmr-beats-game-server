
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


/**
 * Personal mission interface.
 *
 * @interface PersonalMission
 * @property {string} name - The name of the personal mission.
 * @property {string} description - The description of the personal mission.
 * @property {PersonalMissionRequirement} requirement - The requirement of the personal mission.
 */
export interface PersonalMission {
	name: string;
	missionType: 'personal';
	description: string;
	requirement: PersonalMissionRequirement;
}

/**
 * Personal mission requirement interface.
 * 
 * @interface PersonalMissionRequirement
 * @property {Object} criteria - The criteria of the personal mission requirement.
 * @property {string} criteria.type - The type of the criteria.
 * @property {number} criteria.value - The value of the criteria.
 * @property {string} criteria.description - The description of the criteria.
 */
interface PersonalMissionRequirement {
	criteria: {
		type: "uniqueSongs" | "score";
		value: number;
		group?: string;
		description: string;
        reward: { name: string, cards?: Array<any>, beats?: number, amount: number };
	};
}


/**
 * Collection mission interface.
 *
 * @interface CollectionMission
 * @property {string} name - The name of the collection mission.
 * @property {string} description - The description of the collection mission.
 * @property {CollectionMissionRequirement} requirement - The requirement of the collection mission.
 */
export interface CollectionMission {
	name: string;
	missionType: 'collection';
	description: string;
	requirement: CollectionMissionRequirement;
}

/**
 * Collection mission requirement interface.
 *
 * @interface CollectionMissionRequirement
 * @property {Object} criteria - The criteria of the collection mission requirement.
 * @property {string} criteria.type - The type of the criteria (e.g., "random" or "specificGroup").
 * @property {number} criteria.value - The number of cards required to complete the mission.
 * @property {string} [criteria.group] - The specific group of cards required (if applicable).
 * @property {string} criteria.description - The description of the criteria.
 * @property {string} criteria.reward - The reward for completing the mission.
 */
interface CollectionMissionRequirement {
	criteria: {
		type: "random" | "specificGroup";
		value: number;
		group?: string; // Optional, only needed for specific groups
		description: string;
        reward: { name: string, cards?: Array<any>, beats?: number, amount: number };
	};
}
