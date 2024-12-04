export const followCypher: string = `
    MATCH (u:User {username: $userName}) 
    MATCH (p:User {username: $userToFollow})
    MERGE (u)-[r:FOLLOW]->(p)
    ON CREATE SET u.createdAt = timestamp()
    RETURN p 
    {.*, 
    followed: true} 
    AS follow
    `

export const getFollowersFollowingCountCypher: string =           `
    MATCH (u:User {username: $username})
    OPTIONAL MATCH (u)-[:FOLLOW]->(following:User)
    OPTIONAL MATCH (follower:User)-[:FOLLOW]->(u)
    RETURN COUNT(DISTINCT following) as followingCount, COUNT(DISTINCT follower) as followerCount
    `