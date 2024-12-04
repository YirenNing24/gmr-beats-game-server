//** ELYSIA TYPE VALIDATION IMPORT
import { t } from "elysia";


export const beatsLoginSchema = {
    body: t.Object({ username: t.String(), password: t.String() })
}

export const buyCardSchema = {
    headers: t.Object({ 
        authorization: t.String() }), 
    body: t.Object({ 
        listingId: t.Number(), 
        uri: t.String() })
}


export const buyCardUpgradeSchema = {
    headers: t.Object({ 
        authorization: t.String() }), 
    body: t.Object({ 
        listingId: t.Number(), 
        uri: t.String(),
        quantity: t.String() 
    }),
        
}


export const buyCardPackSchema = {
    headers: t.Object({ 
        authorization: t.String() }), 
    body: t.Object({ 
        listingId: t.Number(), 
        uri: t.String(),
    }),
        
}