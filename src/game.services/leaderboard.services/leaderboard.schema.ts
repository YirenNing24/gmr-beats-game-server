import { t } from "elysia";



export const classicScoreStatsSchema = {
    headers: t.Object({ 
        "x-api-key": t.String()
    }), 
    body: t.Object({
        difficulty: t.String(),
        score: t.Number(),
        combo: t.Number(),
        maxCombo: t.Number(),
        accuracy: t.Number(),
        finished: t.Boolean(),
        songName: t.String(),
        artist: t.String(),
        perfect: t.Number(),
        veryGood: t.Number(),
        good: t.Number(),
        bad: t.Number(),
        miss: t.Number(),
        username: t.String(),
        peerId: t.Number()
    })
};


export const getClassicScoreStatsSingle = {
    headers: t.Object({ 
        authorization: t.String()
    }), 
    query: t.Object({
        peerId: t.String({})

    })
};

export const getClassicLeaderboardSchema = {
    headers: t.Object({ 
        authorization: t.String()
    }), 
    query: t.Object({
        // gameMode: t.String(), 
        songName: t.String(), 
        period: t.String(), 
        difficulty: t.String()
    })
};


