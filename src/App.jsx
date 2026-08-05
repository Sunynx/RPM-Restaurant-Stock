import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, LayoutDashboard, LogIn, LogOut, Loader2, Users, Sun, Moon, UploadCloud, Bell, Search, MoreHorizontal, AlertCircle, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import AdminPanel from './components/AdminPanel';
import ReportPanel from './components/ReportPanel';
import SkeletonUI from './components/SkeletonUI';
import AddProductModal from './components/AddProductModal';
import EditModal from './components/EditModal';
import EditProductDetailsModal from './components/EditProductDetailsModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import { fetchInventoryFromSharePoint, updateInventoryInSharePoint, fetchAppUsers, fetchTransactions, createProductInSharePoint, fetchCategories, writeAuditLog, createGenericSharePointItem, updateProductDetailsInSharePoint, createCategoryInSharePoint, updateUserRoleInSharePoint, addUserToSharePoint, updateUserDetailsInSharePoint, deleteUserFromSharePoint } from './graphService';
import toast from 'react-hot-toast';
import CSVImporterModal from './components/CSVImporterModal';

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Scroll to top when changing tabs
  useEffect(() => {
    // Timeout ensures DOM is painted on mobile before scrolling
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
      
      const contentArea = document.querySelector('.content-area');
      if (contentArea) contentArea.scrollTop = 0;
      
      const mainArea = document.querySelector('.main-area');
      if (mainArea) mainArea.scrollTop = 0;
    }, 10);
  }, [activeTab]);

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
  
  const [selectedProfile, setSelectedProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedProfile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSelectProfile = (profile) => {
    setSelectedProfile(profile);
    localStorage.setItem('selectedProfile', JSON.stringify(profile));
  };

  const handleClearProfile = () => {
    setSelectedProfile(null);
    localStorage.removeItem('selectedProfile');
  };
  
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

  const availableProfiles = useMemo(() => {
    if (!accounts[0]?.username || !appUsers.length) return [];
    return appUsers.filter(u => u.email && u.email.toLowerCase() === accounts[0].username.toLowerCase());
  }, [appUsers, accounts]);

  const shouldShowProfileSelector = isAuthenticated && !isLoadingUsers && availableProfiles.length > 1 && !selectedProfile;

  useEffect(() => {
    if (isAuthenticated && !isLoadingUsers && availableProfiles.length === 1 && !selectedProfile) {
      handleSelectProfile(availableProfiles[0]);
    }
  }, [isAuthenticated, isLoadingUsers, availableProfiles, selectedProfile]);

  const userRole = useMemo(() => {
    if (!accounts[0]) return 'Staff';
    if (selectedProfile) return selectedProfile.role;
    const me = availableProfiles[0];
    return me ? me.role : 'Staff';
  }, [availableProfiles, selectedProfile, accounts]);

  const userInitials = useMemo(() => {
    const name = selectedProfile?.name || accounts[0]?.name || 'User';
    if (name === 'User') return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [accounts, selectedProfile]);

  const alertItems = useMemo(() => {
    return inventory.filter(i => {
      const closing = parseInt(i.closing) || 0;
      const minStock = parseInt(i.minStockLevel) || LOW_STOCK_THRESHOLD;
      return closing <= minStock;
    });
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter(item => item.closing < LOW_STOCK_THRESHOLD).length;
  }, [inventory]);

  const updateMutation = useMutation({
    mutationFn: (updatedItem) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return updateInventoryInSharePoint(accessToken, updatedItem.id, updatedItem, performedBy);
    },
    onMutate: async (updatedItem) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previousInventory = queryClient.getQueryData(['inventory']);
      const optimisticItem = { 
        ...updatedItem, 
        stockOnHand: updatedItem.closing,
        sales: 0, 
        ent: 0, 
        issued: 0 
      };
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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
    mutationFn: (updatedFields) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return updateProductDetailsInSharePoint(accessToken, editingProductDetails.id, updatedFields, performedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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
    mutationFn: (productData) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return createProductInSharePoint(accessToken, productData, performedBy);
    },
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
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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
    mutationFn: ({ userId, newRole, targetEmail }) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return updateUserRoleInSharePoint(accessToken, userId, newRole, performedBy, targetEmail);
    },
    onSuccess: () => {
      toast.success("User role updated!");
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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

  const updateUserDetailsMutation = useMutation({
    mutationFn: ({ userId, updatedFields, targetEmail }) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return updateUserDetailsInSharePoint(accessToken, userId, updatedFields, performedBy, targetEmail);
    },
    onSuccess: () => {
      toast.success("User details updated!");
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update user details.");
    }
  });

  const handleUpdateUser = (userId, updatedFields, targetEmail) => {
    if (!accessToken) return;
    updateUserDetailsMutation.mutate({ userId, updatedFields, targetEmail });
  };

  const deleteUserMutation = useMutation({
    mutationFn: ({ userId, targetEmail }) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return deleteUserFromSharePoint(accessToken, userId, performedBy, targetEmail);
    },
    onSuccess: () => {
      toast.success("User removed successfully!");
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to remove user.");
    }
  });

  const handleDeleteUser = (userId, targetEmail) => {
    if (!accessToken) return;
    deleteUserMutation.mutate({ userId, targetEmail });
  };

  const addUserMutation = useMutation({
    mutationFn: (userData) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return addUserToSharePoint(accessToken, userData, performedBy);
    },
    onSuccess: () => {
      toast.success("User added successfully!");
      queryClient.invalidateQueries({ queryKey: ['appUsers'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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
    mutationFn: (categoryData) => {
      const performedBy = selectedProfile?.name || accounts[0]?.username;
      return createCategoryInSharePoint(accessToken, categoryData, performedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
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

        // Map Category dynamically for Products
        if (listName === 'Inventory_Products') {
          if (fields.Category) {
            // Find category by name (case-insensitive)
            const catName = String(fields.Category).trim().toLowerCase();
            const actualCategory = categories.find(c => c.name.toLowerCase() === catName);
            if (actualCategory && actualCategory.id) {
              fields.CategoryLookupId = parseInt(actualCategory.id);
            } else {
              console.warn(`Category not found for name: ${fields.Category}`);
            }
            delete fields.Category; // Remove text field to prevent SP schema errors
          } else if (fields.CategoryLookupId) {
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
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  };

  // Page title mapping
  const pageTitle = activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'inventory' ? 'Inventory' : activeTab === 'report' ? 'Report' : 'Admin';

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-bg-circle login-bg-circle--1" />
        <div className="login-bg-circle login-bg-circle--2" />
        <div className="login-bg-circle login-bg-circle--3" />
        <div className="login-card">
          <div className="login-text">
            <h2 className="login-title">Inventory System</h2>
            <p className="login-subtitle">Sign in to manage inventory</p>
          </div>
          <button className="login-btn" onClick={handleLogin}>
            <svg width="20" height="20" viewBox="0 0 23 23" fill="none"><path d="M1 1h10v10H1V1z" fill="#f25022"/><path d="M12 1h10v10H12V1z" fill="#7fba00"/><path d="M1 12h10v10H1V12z" fill="#00a4ef"/><path d="M12 12h10v10H12V12z" fill="#ffb900"/></svg>
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
        <div className="sidebar-brand" style={{ padding: 'var(--sp-8) var(--sp-4) var(--sp-4)', display: 'flex', justifyContent: 'center' }}>
          <div className="sidebar-brand-logo" style={{ width: '140px', background: 'transparent', overflow: 'hidden' }}>
            <img src="/rpm-logo.svg" alt="RPM Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain', objectPosition: 'center' }} />
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

          {['Admin', 'Manager'].includes(userRole) && (
            <>
              <div 
                className={`sidebar-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <Users size={18} />
                <span>Admin</span>
              </div>
              <div 
                className={`sidebar-nav-item ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                <FileText size={18} />
                <span>Report</span>
              </div>
            </>
          )}

        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Click to logout">
            <div className="sidebar-user-avatar">
              {userInitials}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{selectedProfile?.name || accounts[0]?.name || 'User'}</div>
              <div className="sidebar-user-email">{accounts[0]?.username || ''}</div>
            </div>
            {availableProfiles.length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleClearProfile(); }} 
                title="Switch User" 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary-light)', padding: '4px', marginRight: '4px', display: 'flex', alignItems: 'center' }}>
                <Users size={16} />
              </button>
            )}
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
            ) : activeTab === 'admin' ? (
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
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  accessToken={accessToken}
                  setIsCSVModalOpen={setIsCSVModalOpen}
                  categories={categories}
                  onAddCategory={handleAddCategory}
                  inventory={inventory}
                  userRole={userRole}
                />
              </motion.div>
            ) : (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <ReportPanel inventory={inventory} categories={categories} />
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
        {['Admin', 'Manager'].includes(userRole) && (
          <button 
            className={`bottom-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <Users size={22} />
            <span>Admin</span>
          </button>
        )}
        {['Admin', 'Manager'].includes(userRole) && (
          <button 
            className={`bottom-nav-item ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            <FileText size={22} />
            <span>Report</span>
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
        
        {/* Profile Selector Modal */}
        {shouldShowProfileSelector && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '32px' }}
            >
              <Users size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
              <h2 style={{ marginBottom: '8px', fontSize: '20px', color: 'var(--text-primary)' }}>Who's using the app?</h2>
              <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>Please select your profile to continue</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {availableProfiles.map(profile => (
                  <button 
                    key={profile.id}
                    className="btn btn-primary"
                    style={{ padding: '16px', fontSize: '16px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '12px' }}
                    onClick={() => handleSelectProfile(profile)}
                  >
                    <div style={{ 
                      width: '32px', height: '32px', borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.2)', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' 
                    }}>
                      {(() => {
                        const fallbackName = profile.email ? profile.email.split('@')[0] : 'User';
                        const nameStr = profile.name || fallbackName;
                        const parts = nameStr.trim().split(/\s+/);
                        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
                        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                      })()}
                    </div>
                    {profile.name || (profile.email ? profile.email.split('@')[0] : 'Unknown User')}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
