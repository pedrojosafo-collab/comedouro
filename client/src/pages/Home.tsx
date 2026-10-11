          <div className="setting-row">
            <div>
              <strong>Autenticação</strong>
              <span>Gerenciada pelo portal seguro do projeto</span>
            </div>
            <span className="verified">
              <Check size={14} /> Protegida
            </span>
          </div>
        </section>
        <section className="panel settings-card">
          <div>
            <span className="section-kicker">SISTEMA</span>
            <h3>Preferências do painel</h3>
          </div>
          <div className="setting-row">
            <div>
              <strong>Atualização de status</strong>
              <span>
                O dashboard considera o ESP32 online por até 150 segundos sem
                novo heartbeat.
              </span>
            </div>
            <span className="verified">
              <Wifi size={14} /> Automática
            </span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Modo de interface</strong>
              <span>
                Alternância disponível no ícone de lua da barra superior.
              </span>
            </div>
            <Moon size={17} className="muted" />
          </div>
        </section>
      </div>
    </>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const page = location === "/" ? "/dashboard" : location;
  const overview = trpc.app.overview.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });
  const content = useMemo(() => {
    if (page === "/feeding")
      return (
        <FeedingPage
          device={overview.data?.device}
          refetch={() => overview.refetch()}
        />
      );
    if (page === "/schedule")
      return (
        <SchedulePage data={overview.data} refetch={() => overview.refetch()} />
      );
    if (page === "/history") return <HistoryPage data={overview.data} />;
    if (page === "/device")
      return (
        <DevicePage data={overview.data} refetch={() => overview.refetch()} />
      );
    if (page === "/water")
      return (
        <WaterMonitoringPage
          data={overview.data}
          refresh={() => overview.refetch()}
        />
      );
    if (page === "/collaborators")
      return (
        <CollaboratorsPage
          data={overview.data}
          refetch={() => overview.refetch()}
        />
      );
    if (page === "/code") return <CodePage />;
    if (page === "/install") return <InstallPage />;
    if (page === "/about") return <AboutPage />;
    if (page === "/settings") return <SettingsPage user={user} />;
    return (
      <Dashboard
        data={overview.data}
        setPage={setLocation}
        refresh={() => overview.refetch()}
      />
    );
  }, [page, overview.data, overview.refetch, user, setLocation]);
  if (loading)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Droplets size={20} />
        </div>
        <div className="loading-pulse" />
        <span>Carregando seu espaço…</span>
      </div>
    );
  if (!isAuthenticated) return <LoginScreen />;
  return (
    <AppShell
      page={page}
      setPage={setLocation}
      user={user}
      onLogout={() => logout()}
    >
      {overview.isLoading && !overview.data ? (
        <div className="content-loading">
          <RefreshCcw className="spin" size={22} />
          <span>Sincronizando seu comedouro…</span>
        </div>
      ) : (
        content
      )}
    </AppShell>
  );
}
