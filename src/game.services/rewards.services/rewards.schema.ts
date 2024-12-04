import { t } from "elysia";

/**
 * Schema for validating SoulMetaData.
 *
 * @type {Object}
 * @property {string} genre1 - The first genre.
 * @property {string} genre2 - The second genre.
 * @property {string} genre3 - The third genre.
 * @property {string} animal1 - The first animal.
 * @property {string} horoscope - The horoscope.
 */
export const soulMetaDataSchema = {
    headers: t.Object({ 
        authorization: t.String() }), 
    body: t.Object({
        genre1: t?.String(),
        genre2: t?.String(),
        genre3: t?.String(),
        animal1: t?.String(),
        animal2: t?.String(),
        animal3: t?.String(),
        horoscope: t?.String(),
        id: t?.String(),

    })
}


export const claimCardOwnershipRewardSchema = {
    headers: t.Object({ 
        authorization: t.String() }), 
    body: t.Object({
        name: t.String()
    })

}

// username?: string;
// type?: 'song';

// songName?: string;
// songRewardType?: 'first';

// reward?: string;
// rewardName?: string;

// claimed?: boolean;
// claimedAt?: Time
// eligible?: boolean;


export const claimMissionRewardSchema = {
    headers: t.Object({ 
        authorization: t.String() 
    }), 
    body: t.Object({
        id: t.String(),
        username: t.String(),                      // User's name
        type: t.String(),      // Type of mission (optional, only "song" is allowed)
        songName: t.String(),          // Name of the song (optional)
        songRewardType: t.String(), // Type of reward (optional, only "first" is allowed)
        reward: t.String(),            // The reward being claimed (optional)
        rewardName: t.String(),        // Name of the reward (optional)
        claimed: t.Boolean(),          // Status of whether the reward is claimed (optional)         // Timestamp of when the reward was claimed (optional)
        eligible: t.Boolean(),         // Status of eligibility for the reward (optional)
    })
};



// Expected: {
//     "username": "",
//     "type": "",
//     "songName": "",
//     "songRewardType": "",
//     "reward": "",
//     "rewardName": "",
//     "claimed": false,
//     "eligible": false
//   }
  
//   Found: {
//     "claimed": false,
//     "eligible": true,
//     "id": "01268923-04fa-4c27-9776-6ea4f5d247be",
//     "reward": "1000",
//     "rewardName": "First time completing No Doubt",
//     "songName": "No Doubt",
//     "songRewardType": "first",
//     "type": "song",
//     "username": "nashar4"
//   }