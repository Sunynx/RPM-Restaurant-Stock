// src/graphService.js
import { Client } from "@microsoft/microsoft-graph-client";

// Initialize the Graph Client
export const getGraphClient = (accessToken) => {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
};

export const SHAREPOINT_SITE_NAME = "RPM Application";

// List Names
export const LIST_CATEGORIES = "Inventory_Categories";
export const LIST_PRODUCTS = "Inventory_Products";
export const LIST_TRANSACTIONS = "Inventory_Transactions";
export const LIST_USERS = "Inventory_Users";
export const LIST_AUDIT_LOGS = "Inventory_AuditLogs";

let cachedSiteId = null;

async function getSiteId(client) {
  if (cachedSiteId) return cachedSiteId;
  const response = await client.api(`/sites?search=${SHAREPOINT_SITE_NAME}`).get();
  if (response.value && response.value.length > 0) {
    cachedSiteId = response.value[0].id;
    return cachedSiteId;
  }
  throw new Error("SharePoint Site not found!");
}

async function getListId(client, siteId, listName) {
  const listsResponse = await client.api(`/sites/${siteId}/lists`).filter(`displayName eq '${listName}'`).get();
  if (listsResponse.value.length === 0) throw new Error(`List '${listName}' not found!`);
  return listsResponse.value[0].id;
}

// ---------------------------------------------------------
// USERS
// ---------------------------------------------------------
export async function fetchAppUsers(accessToken, currentUserEmail) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_USERS);
    const response = await client.api(`/sites/${siteId}/lists/${listId}/items`).expand('fields').get();
    
    return response.value.map(item => ({
      id: item.id,
      email: item.fields.Title, // Title is Email
      name: item.fields.DisplayName,
      role: item.fields.Role,
      status: item.fields.Status
    })).filter(u => u.status !== 'Inactive');
  } catch (error) {
    console.error("Error fetching Users, defaulting to Admin", error);
    return [{ email: currentUserEmail, role: 'Admin' }];
  }
}

// ---------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------
export async function writeAuditLog(accessToken, userEmail, logType, details, status = "Success") {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_AUDIT_LOGS);
    
    const newLog = {
      Title: logType,
      LogDate: new Date().toISOString(),
      UserEmail: userEmail,
      Details: details,
      Status: status
    };

    await client.api(`/sites/${siteId}/lists/${listId}/items`).post({ fields: newLog });
  } catch (error) {
    console.error("Error writing Audit Log", error);
  }
}

export async function fetchAuditLogs(accessToken) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_AUDIT_LOGS);
    
    const response = await client.api(`/sites/${siteId}/lists/${listId}/items`)
      .expand('fields')
      .orderby('fields/LogDate desc')
      .top(50)
      .get();
      
    return response.value.map(item => ({
      id: item.id,
      title: item.fields.Title,
      date: item.fields.LogDate,
      user: item.fields.UserEmail,
      details: item.fields.Details,
      status: item.fields.Status
    }));
  } catch (error) {
    console.error("Error fetching Audit Logs", error);
    return [];
  }
}

// ---------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------
export async function fetchCategories(accessToken) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_CATEGORIES);
    const response = await client.api(`/sites/${siteId}/lists/${listId}/items`).expand('fields').get();
    
    return response.value.map(item => ({
      id: parseInt(item.id),
      name: item.fields.Title,
      code: item.fields.CategoryCode,
      status: item.fields.Status || 'Active'
    }));
  } catch (error) {
    console.error("Error fetching Categories", error);
    return [];
  }
}

// ---------------------------------------------------------
// PRODUCTS (INVENTORY)
// ---------------------------------------------------------
export async function fetchInventoryFromSharePoint(accessToken) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_PRODUCTS);
    
    const response = await client.api(`/sites/${siteId}/lists/${listId}/items`)
      .expand('fields')
      .top(5000)
      .get();
      
    return response.value.map(item => ({
      id: item.id,
      code: item.fields.Title || 'UNKNOWN', 
      item: item.fields.ProductName || 'Unknown Item',
      categoryId: parseInt(item.fields.CategoryLookupId) || null,
      unit: item.fields.Unit || '',
      price: parseFloat(item.fields.UnitPrice) || 0,
      stockOnHand: parseInt(item.fields.StockOnHand) || 0,
      closing: parseInt(item.fields.StockOnHand) || 0, // Keep closing for backwards compatibility with UI
      minStockLevel: parseInt(item.fields.MinStockLevel) || 0,
      status: item.fields.Status || 'Active',
      // Reset transaction fields for UI
      sales: 0,
      ent: 0,
      issued: 0
    }));
  } catch (error) {
    console.error("Error fetching Products", error);
    throw error;
  }
}

export async function createProductInSharePoint(accessToken, productData, userEmail) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_PRODUCTS);

    const newProduct = {
      Title: productData.code,
      ProductName: productData.item,
      CategoryLookupId: productData.categoryId ? parseInt(productData.categoryId) : null,
      Unit: productData.unit,
      UnitPrice: parseFloat(productData.price) || 0,
      StockOnHand: parseInt(productData.stockOnHand) || 0,
      MinStockLevel: parseInt(productData.minStockLevel) || 0,
      Status: 'Active'
    };

    const res = await client.api(`/sites/${siteId}/lists/${listId}/items`).post({ fields: newProduct });
    
    // Log creation
    await writeAuditLog(accessToken, userEmail, "AddProduct", `Created product ${productData.code}: ${productData.item}`);
    
    return res;
  } catch (error) {
    console.error("Error creating product", error);
    throw error;
  }
}

// ---------------------------------------------------------
// TRANSACTIONS
// ---------------------------------------------------------
export async function fetchTransactions(accessToken) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, LIST_TRANSACTIONS);

    const response = await client.api(`/sites/${siteId}/lists/${listId}/items`)
      .expand('fields')
      .top(5000)
      .get();

    return response.value.map(item => ({
      id: item.id,
      transactionId: item.fields.Title,
      date: item.fields.TransactionDate,
      type: item.fields.TransactionType,
      productId: item.fields.ProductLookupId,
      quantity: parseFloat(item.fields.Quantity) || 0,
      remarks: item.fields.Remarks || '',
      performedBy: item.fields.PerformedBy || ''
    }));
  } catch (error) {
    console.error("Error fetching transactions", error);
    return [];
  }
}

export async function updateInventoryInSharePoint(accessToken, itemId, updatedData, userEmail) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const productsListId = await getListId(client, siteId, LIST_PRODUCTS);
    const txListId = await getListId(client, siteId, LIST_TRANSACTIONS);

    // 1. Update Product Stock
    await client.api(`/sites/${siteId}/lists/${productsListId}/items/${itemId}/fields`)
      .patch({
        StockOnHand: updatedData.closing // New calculated stock
      });

    // 2. Insert Transactions
    const createTransaction = async (type, quantity) => {
      const txFields = {
        Title: `TX-${Date.now()}`,
        TransactionDate: new Date().toISOString(),
        TransactionType: type,
        ProductLookupId: parseInt(itemId), // This must be the SharePoint list item ID of the product
        Quantity: quantity,
        PerformedBy: userEmail
      };
      await client.api(`/sites/${siteId}/lists/${txListId}/items`).post({ fields: txFields });
    };

    if (updatedData.sales > 0) await createTransaction('Sales', -updatedData.sales);
    if (updatedData.ent > 0) await createTransaction('ENT', -updatedData.ent);
    if (updatedData.issued > 0) await createTransaction('Receive', updatedData.issued);

    // Log update
    await writeAuditLog(accessToken, userEmail, "UpdateStock", `Updated stock for product ID ${itemId}. New Stock: ${updatedData.closing}`);

    // Check for low stock and trigger LINE Notify
    const minStockLevel = parseInt(updatedData.minStockLevel) || 10;
    if (updatedData.closing < minStockLevel) {
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: updatedData.item || `Item ID ${itemId}`,
            stock: updatedData.closing,
            minStock: minStockLevel
          })
        });
      } catch (notifyErr) {
        console.error("Error triggering LINE notify:", notifyErr);
      }
    }

    return true;
  } catch (error) {
    console.error("Error updating stock", error);
    throw error;
  }
}

export async function updateProductDetailsInSharePoint(accessToken, itemId, updatedFields, userEmail) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const productsListId = await getListId(client, siteId, LIST_PRODUCTS);

    await client.api(`/sites/${siteId}/lists/${productsListId}/items/${itemId}/fields`)
      .patch({
        Title: updatedFields.code,
        ProductName: updatedFields.item,
        CategoryLookupId: updatedFields.categoryId ? parseInt(updatedFields.categoryId) : null,
        Unit: updatedFields.unit,
        UnitPrice: parseFloat(updatedFields.price) || 0,
        MinStockLevel: parseInt(updatedFields.minStockLevel) || 0
      });

    // Log update
    await writeAuditLog(accessToken, userEmail, "UpdateProductDetails", `Updated details for product ${updatedFields.code}`);

    return true;
  } catch (error) {
    console.error("Error updating product details", error);
    throw error;
  }
}

// ---------------------------------------------------------
// GENERIC IMPORT (CSV)
// ---------------------------------------------------------
export async function createGenericSharePointItem(accessToken, listName, dataFields) {
  const client = getGraphClient(accessToken);
  try {
    const siteId = await getSiteId(client);
    const listId = await getListId(client, siteId, listName);

    const res = await client.api(`/sites/${siteId}/lists/${listId}/items`).post({ fields: dataFields });
    return res;
  } catch (error) {
    console.error(`Error creating item in ${listName}`, error);
    throw error;
  }
}
