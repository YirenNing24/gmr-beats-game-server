

const inventorySchema: string = ''

export const inventoryCypher: string = `
WITH [
	{label: "X_IN", members: ["Esha", "Nizz", "Nova", "Hannah", "Aria"]},
	{label: "GREATGUYS", members: ["DongHwi", "HoRyeong", "BaekGyeol"]},
	{label: "ICU", members: ["Abin", "Naye", "ChaeI", "Loa"]},
	{label: "IROHM", members: ["Vocals", "Instrumental"]}
] AS inventoryGroups

UNWIND inventoryGroups AS group
CREATE (inv:Inventory {type: group.label})
FOREACH (member IN group.members |
	SET inv[member] = {uri: "", tokenId: "", contractAddress: "", group: "", slot: ""}
)

MATCH (u:User)
MERGE (u)-[:INVENTORY]->(inv);

`;
