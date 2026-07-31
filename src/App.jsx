import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, LayoutDashboard, LogIn, LogOut, Loader2, Users, Sun, Moon, UploadCloud, Bell, Search, MoreHorizontal, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import AdminPanel from './components/AdminPanel';
import SkeletonUI from './components/SkeletonUI';
import AddProductModal from './components/AddProductModal';
import EditModal from './components/EditModal';
import EditProductDetailsModal from './components/EditProductDetailsModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import { fetchInventoryFromSharePoint, updateInventoryInSharePoint, fetchAppUsers, fetchTransactions, createProductInSharePoint, fetchCategories, writeAuditLog, createGenericSharePointItem, updateProductDetailsInSharePoint, createCategoryInSharePoint, updateUserRoleInSharePoint, addUserToSharePoint } from './graphService';
import toast from 'react-hot-toast';
import CSVImporterModal from './components/CSVImporterModal';

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialFilters, setInitialFilters] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingProductDetails, setEditingProductDetails] = useState(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [accessToken, setAccessToken] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const LOW_STOCK_THRESHOLD = 10;

  const handleLogin = async () => {
    // Clear any stuck interaction states from previous failed redirects
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes("interaction.status")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("Failed to clear MSAL interaction status", e);
    }

    instance.loginRedirect(loginRequest).catch(e => {
      console.error("Login redirect failed:", e);
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleLogout = async () => {
    // 1. Clear all cached backend data for security and stability
    queryClient.clear();
    setAccessToken(null);

    // 2. Perform stable redirect logout
    const currentAccount = instance.getActiveAccount() || accounts[0];
    
    instance.logoutRedirect({ 
      postLogoutRedirectUri: window.location.origin,
      account: currentAccount,
      logoutHint: currentAccount?.idTokenClaims?.login_hint || currentAccount?.username
    });
  };

  useEffect(() => {
    if (isAuthenticated && accounts[0]) {
      instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0]
      }).then((response) => {
        setAccessToken(response.accessToken);
      }).catch((error) => {
        console.error("Token silent error:", error);
        if (error.name === "InteractionRequiredAuthError") {
           instance.acquireTokenRedirect(loginRequest);
        }
      });
    }
  }, [isAuthenticated, accounts, instance]);

  const { data: inventory = [], isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => fetchInventoryFromSharePoint(accessToken),
    enabled: !!accessToken,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchCategories(accessToken),
    enabled: !!accessToken,
  });

  const { data: appUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['appUsers'],
    queryFn: () => fetchAppUsers(accessToken, accounts[0].username),
    enabled: !!accessToken && !!accounts[0]?.username,
  });

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions(accessToken),
    enabled: !!accessToken,
  });

  const loading = isLoadingInventory || isLoadingUsers || isLoadingTransactions || isLoadingCategories;

  const userRole = useMemo(() => {
    if (!accounts[0]) return 'Staff';
    const me = appUsers.find(u => u.email.toLowerCase() === accounts[0].username.toLowerCase());
    return me ? me.role : 'Staff';
  }, [appUsers, accounts]);

  const alertItems = useMemo(() => {
    return inventory.filter(i => {
      const minStock = i.minStockLevel || 0;
      return minStock > 0 ? i.closing < minStock : i.closing === 0;
    });
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter(item => item.closing < LOW_STOCK_THRESHOLD).length;
  }, [inventory]);

  const updateMutation = useMutation({
    mutationFn: (updatedItem) => updateInventoryInSharePoint(accessToken, updatedItem.id, updatedItem, accounts[0]?.username),
    onMutate: async (updatedItem) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previousInventory = queryClient.getQueryData(['inventory']);
      const optimisticItem = { ...updatedItem, sales: 0, ent: 0, issued: 0 };
      queryClient.setQueryData(['inventory'], old => 
        old?.map(item => item.id === updatedItem.id ? optimisticItem : item)
      );
      setEditingItem(null);
      return { previousInventory };
    },
    onError: (err, updatedItem, context) => {
      queryClient.setQueryData(['inventory'], context.previousInventory);
      toast.error("Failed to update item in SharePoint. Check console.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onSuccess: () => {
      toast.success("Item updated successfully!");
    }
  });

  const handleSaveItem = (updatedItem) => {
    if (!accessToken) return;
    updateMutation.mutate(updatedItem);
  };

  const updateDetailsMutation = useMutation({
    mutationFn: (updatedFields) => updateProductDetailsInSharePoint(accessToken, editingProductDetails.id, updatedFields, accounts[0]?.username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setEditingProductDetails(null);
      toast.success("Product details updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update product details");
      console.error(error);
    }
  });

  const handleSaveProductDetails = (updatedItem) => {
    if (!accessToken) return;
    updateDetailsMutation.mutate(updatedItem);
  };

  const addProductMutation = useMutation({
    mutationFn: (productData) => createProductInSharePoint(accessToken, productData, accounts[0]?.username),
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previousInventory = queryClient.getQueryData(['inventory']);
      
      const optimisticItem = { 
        ...newProduct, 
        id: 'temp-' + Date.now(),
        closing: newProduct.stockOnHand || 0,
        opening: newProduct.stockOnHand || 0,
        sales: 0, 
        ent: 0, 
        issued: 0 
      };
      
      queryClient.setQueryData(['inventory'], old => [optimisticItem, ...(old || [])]);
      setIsAddingProduct(false); // Close modal instantly
      
      return { previousInventory };
    },
    onError: (err, newProduct, context) => {
      if (context?.previousInventory) {
        queryClient.setQueryData(['inventory'], context.previousInventory);
      }
      toast.error("Failed to add product");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onSuccess: () => {
      toast.success("Product added successfully!");
    }
  });

  const handleAddProduct = (productData) => {
    if (!accessToken) return;
    addProductMutation.mutate(productData);
  };

  const editUserRoleMutation = useMutation({
    mutationFn: ({ userId, newRole, targetEmail }) => updateUserRoleInSharePoint(accessToken, userId, newRole, accounts[0]?.username, targetEmail),
    onSuccess: () => {
      toast.success("User role updated!");
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update user role.");
    }
  });

  const handleEditUserRole = (userId, newRole, targetEmail) => {
    if (!accessToken) return;
    editUserRoleMutation.mutate({ userId, newRole, targetEmail });
  };

  const addUserMutation = useMutation({
    mutationFn: (userData) => addUserToSharePoint(accessToken, userData, accounts[0]?.username),
    onSuccess: () => {
      toast.success("User added successfully!");
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to add user.");
    }
  });

  const handleAddUser = (userData) => {
    if (!accessToken) return;
    addUserMutation.mutate(userData);
  };

  const addCategoryMutation = useMutation({
    mutationFn: (categoryData) => createCategoryInSharePoint(accessToken, categoryData, accounts[0]?.username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success("Category added successfully!");
    },
    onError: (error) => {
      toast.error("Failed to add category");
      console.error(error);
    }
  });

  const handleAddCategory = (categoryData) => {
    if (!accessToken) return;
    addCategoryMutation.mutate(categoryData);
  };

  const handleProcessImport = async (listName, dataRows) => {
    if (!accessToken) return;
    
    if (listName === 'Inventory_Products' && categories.length === 0) {
      toast.error("Categories are not loaded yet! Please refresh the page or make sure Categories are imported first.");
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: dataRows.length, errors: 0 });
    
    let current = 0;
    let errors = 0;

    for (const row of dataRows) {
      try {
        // Clean empty fields that might break SP
        const fields = {};
        Object.keys(row).forEach(key => {
          if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
            fields[key] = row[key];
          }
        });

        // Enforce data types for SharePoint text columns
        if (fields.Title !== undefined) fields.Title = String(fields.Title);
        if (fields.ProductName !== undefined) fields.ProductName = String(fields.ProductName);
        if (fields.Unit !== undefined) fields.Unit = String(fields.Unit);

        // Map CategoryLookupId dynamically for Products
        if (listName === 'Inventory_Products' && fields.CategoryLookupId) {
          const rawId = parseInt(fields.CategoryLookupId);
          if ([1, 2, 3].includes(rawId)) {
            const catCode = `CAT-00${rawId}`;
            const actualCategory = categories.find(c => c.code === catCode);
            if (actualCategory && actualCategory.id) {
              fields.CategoryLookupId = parseInt(actualCategory.id);
            } else {
              console.warn(`Category not found for code: ${catCode}. Dropping CategoryLookupId.`);
              delete fields.CategoryLookupId;
            }
          }
        }

        console.log(`Payload for ${listName}:`, fields);
        await createGenericSharePointItem(accessToken, listName, fields);
      } catch (err) {
        console.error("Import error for row", row, err);
        errors++;
      }
      current++;
      setImportProgress({ current, total: dataRows.length, errors });
    }

    setIsImporting(false);
    toast.success(`Import completed! ${current - errors} succeeded, ${errors} failed.`);
    if (listName === 'Inventory_Products' || listName === 'Inventory_Categories') {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  };

  // Page title mapping
  const pageTitle = activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'inventory' ? 'Inventory' : 'Admin';

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <img src="/rpm-logo.svg" alt="RPM Logo" />
          </div>
          <div className="login-divider" />
          <p className="login-subtitle">Sign in to manage inventory</p>
          <button className="login-btn" onClick={handleLogin}>
            <LogIn size={18} />
            <span>Login with Microsoft 365</span>
          </button>
          <p className="login-footer-text">Secured by Microsoft Azure AD</p>
        </div>
        <div className="login-copyright">© 2026 Royal Phuket Marina</div>
      </div>
    );
  }

  const handleNotificationClick = (item) => {
    setShowNotifications(false);
    setActiveTab('inventory');
    setInitialFilters({ searchTerm: item.code });
  };

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ padding: 'var(--sp-6) var(--sp-4) var(--sp-4)', height: 110 }}>
          <div className="sidebar-brand-logo" style={{ width: '100%', height: '100%', background: 'transparent', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <img src="/rpm-logo.svg" alt="RPM Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          </div>
        </div>
        <div className="sidebar-divider" style={{ margin: '0 var(--sp-4)' }}></div>

        <nav className="sidebar-nav" style={{ marginTop: 'var(--sp-4)' }}>
          <div 
            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
          <div 
            className={`sidebar-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={18} />
            <span>Inventory</span>
          </div>

          {userRole === 'Admin' && (
            <>
              <div 
                className={`sidebar-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <Users size={18} />
                <span>Admin</span>
              </div>
            </>
          )}

        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Click to logout">
            <div className="sidebar-user-avatar">
              {(accounts[0]?.name || 'User').substring(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{accounts[0]?.name || 'User'}</div>
              <div className="sidebar-user-email">{accounts[0]?.username || ''}</div>
            </div>
            <LogOut size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h2 className="topbar-title">{pageTitle}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: loading ? 'var(--primary)' : 'var(--text-tertiary)', marginLeft: 'var(--sp-2)' }}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span className="mobile-hide" style={{ fontWeight: 500 }}>Syncing...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                  <span className="mobile-hide">Synced</span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {/* Theme Toggle */}
            <button 
              className="topbar-icon-btn" 
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notifications */}
            <div className="notification-bell-wrapper">
              <button 
                className="topbar-icon-btn" 
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                <Bell size={18} />
                {alertItems.length > 0 && (
                  <div className="notification-badge">{alertItems.length}</div>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    className="notifications-dropdown"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="notifications-header">
                      <span>Notifications</span>
                      {alertItems.length > 0 && (
                        <span className="badge badge-error">{alertItems.length}</span>
                      )}
                    </div>
                    <div className="notifications-body">
                      {alertItems.length === 0 ? (
                        <div className="notification-empty">
                          You're all caught up!
                        </div>
                      ) : (
                        alertItems.map(item => (
                          <div 
                            key={item.id} 
                            className="notification-item"
                            onClick={() => handleNotificationClick(item)}
                          >
                            {item.closing === 0 ? (
                              <AlertCircle size={16} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
                            ) : (
                              <AlertTriangle size={16} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                {item.item}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {item.closing === 0 ? 'Out of stock!' : `Low stock: ${item.closing} left (Min: ${item.minStockLevel || 0})`}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Logout (Mobile) */}
            <button 
              className="topbar-icon-btn mobile-only"
              onClick={handleLogout}
              title="Logout"
              style={{ color: 'var(--danger)' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="content-area">
          <AnimatePresence mode="wait">
            {loading && inventory.length === 0 ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SkeletonUI type={activeTab} />
              </motion.div>
            ) : activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Dashboard 
                  inventory={inventory} 
                  categories={categories}
                  lowStockThreshold={LOW_STOCK_THRESHOLD} 
                  onNavigate={(filters = null) => {
                    if (filters) setInitialFilters(filters);
                    setActiveTab('inventory');
                  }}
                  transactions={transactions}
                  userRole={userRole}
                />
              </motion.div>
            ) : activeTab === 'inventory' ? (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <InventoryList 
                  inventory={inventory}
                  categories={categories}
                  lowStockThreshold={LOW_STOCK_THRESHOLD}
                  onEdit={setEditingItem}
                  onEditDetails={setEditingProductDetails}
                  onAddProduct={() => setIsAddingProduct(true)}
                  userRole={userRole}
                  initialFilters={initialFilters}
                  onFiltersConsumed={() => setInitialFilters(null)}
                />
              </motion.div>
            ) : activeTab === 'notifications' ? (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>Notifications</h3>
                    {alertItems.length > 0 && <span className="badge badge-error">{alertItems.length}</span>}
                  </div>
                  <div style={{ margin: '0 calc(-1 * var(--sp-4))' }}>
                    {alertItems.length === 0 ? (
                      <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        You're all caught up!
                      </div>
                    ) : (
                      <div>
                        {alertItems.map(item => (
                          <div 
                            key={item.id} 
                            className="notification-item"
                            onClick={() => {
                              handleNotificationClick(item);
                              setActiveTab('inventory');
                            }}
                            style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border-subtle)' }}
                          >
                            {item.closing === 0 ? (
                              <AlertCircle size={20} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
                            ) : (
                              <AlertTriangle size={20} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                {item.item}
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                {item.closing === 0 ? 'Out of stock!' : `Low stock: ${item.closing} left (Min: ${item.minStockLevel || 0})`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <AdminPanel 
                  users={appUsers}
                  onAddUser={handleAddUser}
                  onEditUserRole={handleEditUserRole}
                  accessToken={accessToken}
                  setIsCSVModalOpen={setIsCSVModalOpen}
                  categories={categories}
                  onAddCategory={handleAddCategory}
                  inventory={inventory}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* CSV Modal */}
          <AnimatePresence>
            {isCSVModalOpen && (
              <CSVImporterModal 
                onClose={() => setIsCSVModalOpen(false)} 
                onImport={handleProcessImport}
                isImporting={isImporting}
                importProgress={importProgress}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={22} />
          <span>Dashboard</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Package size={22} />
          <span>Stock</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'notifications' ? 'active' : ''} mobile-only`}
          onClick={() => setActiveTab('notifications')}
        >
          <div style={{ position: 'relative' }}>
            <Bell size={22} />
            {alertItems.length > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--bg-body)' }} />
            )}
          </div>
          <span>Alerts</span>
        </button>
        {userRole === 'Admin' && (
          <button 
            className={`bottom-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <Users size={22} />
            <span>Admin</span>
          </button>
        )}
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {editingItem && (
          <EditModal 
            item={editingItem} 
            categories={categories}
            onClose={() => setEditingItem(null)} 
            onSave={handleSaveItem}
            userRole={userRole}
          />
        )}
        {isAddingProduct && (
          <AddProductModal 
            categories={categories}
            onClose={() => setIsAddingProduct(false)}
            onSave={handleAddProduct}
          />
        )}
        {editingProductDetails && (
          <EditProductDetailsModal 
            item={editingProductDetails}
            categories={categories}
            onClose={() => setEditingProductDetails(null)}
            onSave={handleSaveProductDetails}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
