import '@mantine/core/styles.css';
import { useCallback, useEffect, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import NewMember from './components/NewMember';
import {
  Button,
  Container,
  Group,
  MantineProvider,
  createTheme,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { ButtonProps, MantineTheme } from '@mantine/core';

import MemberList from './components/MemberList';
import Login from './components/Login';
import type { Member } from './types';

function ReloadButton({
  onRefresh,
}: {
  readonly onRefresh: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      w={40}
      h={36}
      p={0}
      aria-label="Refresh members"
      loading={loading}
      onClick={handleRefresh}
    >
      {!loading && <IconRefresh size={18} />}
    </Button>
  );
}

const theme = createTheme({
  colors: {
    blue: [
      '#E9EFFF',
      '#D5DFFF',
      '#ADC0FF',
      '#85A0FF',
      '#5D7FFF',
      '#3C65F4',
      '#2855E8',
      '#2147C4',
      '#1A399D',
      '#122A73',
    ],
    orange: [
      '#FFF0EB',
      '#FFDED4',
      '#FFC2B0',
      '#FFA68C',
      '#FF8E6C',
      '#FF825E',
      '#FF794F',
      '#E85E39',
      '#C94729',
      '#A3321B',
    ],
    gray: [
      '#E1E9F7',
      '#C9D6ED',
      '#AABBDD',
      '#8EA4CA',
      '#7188AD',
      '#5B7297',
      '#475D80',
      '#344B70',
      '#273D60',
      '#192F50',
    ],
    dark: [
      '#F3F6FF',
      '#DCE5F8',
      '#AABBDD',
      '#8298BE',
      '#617AA5',
      '#40577F',
      '#2A4167',
      '#172746',
      '#0F1E3A',
      '#101D40',
    ],
    green: [
      '#E9FFF5',
      '#C8F8E1',
      '#A5F0CC',
      '#7DE5B5',
      '#62DBA5',
      '#55D69E',
      '#36BB81',
      '#259967',
      '#18764F',
      '#0D5639',
    ],
    red: [
      '#FFF0F1',
      '#FFDEE1',
      '#FFC3C8',
      '#FFA2AA',
      '#FF858F',
      '#FF737E',
      '#EA5D69',
      '#C94754',
      '#A83541',
      '#862630',
    ],
  },
  primaryColor: 'blue',
  primaryShade: 6,
  defaultRadius: 'md',
  fontSizes: {
    xs: '0.69rem',
    sm: '0.92rem',
    md: '1.04rem',
    lg: '1.16rem',
    xl: '1.27rem',
  },
  components: {
    Button: {
      vars: (_theme: MantineTheme, { size }: ButtonProps) => ({
        root: {
          '--button-padding-x': `calc(var(--button-padding-x-${size ?? 'sm'}) * 0.8)`,
        },
      }),
    },
  },
});

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [dueOnly, setDueOnly] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Check authentication first whenever the application loads.
  useEffect(() => {
    let active = true;

    fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    })
      .then((response) => {
        if (active) {
          setAuthenticated(response.ok);
        }
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch the latest members without reloading the page.
  const loadMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/members', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load members');
      }

      const data: Member[] = await response.json();

      setMembers(data);
      setPhotoRefreshKey((key) => key + 1);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Fetch members only after authentication succeeds.
  useEffect(() => {
    if (authenticated !== true) return;

    void loadMembers();
  }, [authenticated, loadMembers]);

  let content;

  if (authenticated === null) {
    content = <Text>Checking login...</Text>;
  } else if (authenticated === false) {
    content = <Login onLogin={() => setAuthenticated(true)} />;
  } else {
    content = (
      <>
        <Group gap="xs" className="member-actions">
          <NewMember onCreated={loadMembers} />

          {dueOnly ? (
            <Button variant="outline" onClick={() => setDueOnly(false)}>
              Go Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setDueOnly(true)}>
              Pending
            </Button>
          )}

          <ReloadButton onRefresh={loadMembers} />
        </Group>

        {!loaded && !error && <Text>Loading...</Text>}

        {error && (
          <Text c="red">
            Could not load members. Click refresh to try again.
          </Text>
        )}

        {loaded && !error && (
          <MemberList
            key={dueOnly ? 'due' : 'all'}
            dueOnly={dueOnly}
            members={members}
            photoRefreshKey={photoRefreshKey}
            onMemberUpdated={loadMembers}
          />
        )}
      </>
    );
  }

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Container size={370} px="md">
        <Stack align="center" gap="md" mih="100dvh" pt="xl">
          <Stack align="center" gap={4}>
            <Title order={1} ta="center" className="brand-accent">
              Power Bull Gym
            </Title>

            <Text ta="center" w="100%" size="lg" c="dimmed">
              Manage your gym members
            </Text>
          </Stack>

          {content}
        </Stack>
      </Container>
    </MantineProvider>
  );
}

export default App;
