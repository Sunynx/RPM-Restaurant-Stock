// src/authConfig.js
import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
    auth: {
        //clientId: "f5171fbf-14a9-4631-aa48-da8dc6a38a5c", //local:5173
        clientId: "7486bca3-4f63-4c52-ba5c-f6e396692ee5",
        authority: "https://login.microsoftonline.com/cf10c7a9-863e-4b9e-8564-28f10b151033",
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: true,
    }
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest = {
    scopes: ["User.Read", "Sites.ReadWrite.All"]
};

export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Proactively acquires a valid, non-expired access token from MSAL.
 * If the current access token is expired or close to expiration, MSAL silently refreshes it.
 * If the session has completely expired (refresh token expired), it triggers redirect to re-authenticate.
 */
export async function getValidAccessToken(instance = msalInstance) {
    const currentInstance = instance || msalInstance;
    const account = currentInstance.getActiveAccount() || currentInstance.getAllAccounts()[0];
    if (!account) return null;

    try {
        const response = await currentInstance.acquireTokenSilent({
            ...loginRequest,
            account
        });
        return response.accessToken;
    } catch (error) {
        console.warn("Silent token acquisition failed:", error);
        const isInteractionRequired = 
            error.name === "InteractionRequiredAuthError" ||
            error.errorCode === "interaction_required" ||
            error.errorCode === "invalid_grant" ||
            error.errorCode === "login_required" ||
            error.errorCode === "consent_required" ||
            (error.message && error.message.toLowerCase().includes("interaction_required"));

        if (isInteractionRequired) {
            console.warn("User interaction required for token renewal. Redirecting...");
            currentInstance.acquireTokenRedirect(loginRequest);
        }
        throw error;
    }
}

