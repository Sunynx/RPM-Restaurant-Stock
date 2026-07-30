// src/authConfig.js
// TODO: Replace with your actual Client ID and Tenant ID once you register the App in Entra ID
export const msalConfig = {
    auth: {
        clientId: "f5171fbf-14a9-4631-aa48-da8dc6a38a5c",
        authority: "https://login.microsoftonline.com/cf10c7a9-863e-4b9e-8564-28f10b151033", 
        redirectUri: "http://localhost:5173",
    },
    cache: {
        cacheLocation: "localStorage", 
        storeAuthStateInCookie: false,
    }
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest = {
    scopes: ["User.Read", "Sites.ReadWrite.All"]
};
