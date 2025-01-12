import { embedDashboard } from '@superset-ui/embedded-sdk';
import { useAuth } from 'react-oidc-context';
import { useState, useEffect } from 'react';

function Facilities() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const auth = useAuth();

    async function embedDashboardWithAuth() {
        try {
            setLoading(true);

            if (!auth.isAuthenticated) {
                auth.signinRedirect();
                return;
            }

            // Get the access token
            const token = auth.user?.access_token;
            
            if (!token) {
                setError('No access token available');
                return;
            }

            // Embed the dashboard
            await embedDashboard({
                id: "facilities",
                supersetDomain: 'YOUR_SUPERSET_URL',
                mountPoint: document.getElementById('dashboard-container'),
                fetchGuestToken: async () => {
                    // Exchange OIDC token for Superset token
                    const response = await fetch('YOUR_BACKEND_URL/api/token/exchange', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Failed to exchange token');
                    }

                    const data = await response.json();
                    return data.token;
                },
                dashboardUiConfig: { 
                    hideTitle: false,
                    filters: {
                        expanded: true
                    }
                }
            });

        } catch (error) {
            setError(error.message);
            console.error('Dashboard embedding failed:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (auth.isAuthenticated) {
            embedDashboardWithAuth();
        }
    }, [auth.isAuthenticated]);

    // Handle different auth states
    if (auth.isLoading) {
        return <div>Loading...</div>;
    }

    if (auth.error) {
        return <div>Authentication error: {auth.error.message}</div>;
    }

    if (loading) {
        return <div>Loading dashboard...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div id="dashboard-container" style={{ height: '100vh' }}></div>
    );
}

