// src/authConfig.js
// TODO: Replace with your actual Client ID and Tenant ID once you register the App in Entra ID
export const msalConfig = {
    auth: {
        //clientId: "f5171fbf-14a9-4631-aa48-da8dc6a38a5c", //local:5173
        clientId: "7486bca3-4f63-4c52-ba5c-f6e396692ee5",
        authority: "https://login.microsoftonline.com/cf10c7a9-863e-4b9e-8564-28f10b151033",
        redirectUri: window.location.origin,
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
