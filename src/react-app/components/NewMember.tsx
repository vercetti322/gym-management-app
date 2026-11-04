import { useState } from 'react';
import {
  Button,
  Image,
  Modal,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import {
  getPlanEndDate,
  getTodayDate,
  planMonthOptions,
} from '../utils/MemberUtils';

export default function CreateMemberButton({
  onCreated,
}: {
  readonly onCreated: () => Promise<void>;
}) {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profession, setProfession] = useState('');
  const [visitTime, setVisitTime] = useState<'AM' | 'PM' | null>(null);
  const [mode, setMode] = useState('UPI');
  const [from, setFrom] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const endDate = getPlanEndDate(from, months);

  const open = () => {
    const start = getTodayDate();

    setName('');
    setPhone('');
    setAddress('');
    setProfession('');
    setVisitTime(null);
    setMode('UPI');
    setFrom(start);
    setMonths(1);
    setOpened(true);
  };

  const createMember = async () => {
    if (
      !name.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !profession.trim() ||
      !visitTime ||
      !from ||
      !endDate
    ) {
      return;
    }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          profession: profession.trim(),
          visitTime,
          startDate: from,
          endDate,
          planDuration: months,
          paymentMode: mode,
        }),
      });

      const data: { message?: string; error?: string } = await response.json();

      if (!response.ok) {
        alert(data.error ?? 'Failed to create member');
        return;
      }

      setOpened(false);
      await onCreated();
    } catch {
      alert('Unable to connect to the server. Please try again.');
    }
  };

  return (
    <>
      <Button color="orange" autoContrast onClick={open}>
        New Member
      </Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={
          <Text fz="xl" fw={700}>
            New Member
          </Text>
        }
        centered
        size="500px"
        radius="lg"
        padding="md"
      >
        <Stack gap="lg">
          <Stack gap="sm">
            <SimpleGrid cols={2} spacing="xs">
              <TextInput
                placeholder="Full name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                size="md"
                required
              />

              <TextInput
                placeholder="Phone number"
                value={phone}
                onChange={(event) => setPhone(event.currentTarget.value)}
                size="md"
                inputMode="numeric"
                maxLength={10}
                required
              />
            </SimpleGrid>

            <TextInput
              label="Address"
              placeholder="Address"
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
              maxLength={600}
              size="md"
              required
            />

            <SimpleGrid cols={2} spacing="xs">
              <TextInput
                label="Profession"
                placeholder="Profession"
                value={profession}
                onChange={(event) => setProfession(event.currentTarget.value)}
                maxLength={100}
                size="md"
                required
              />

              <Select
                label="Usual visit time"
                placeholder="AM or PM"
                data={['AM', 'PM']}
                value={visitTime}
                onChange={(value) =>
                  setVisitTime(value === 'AM' || value === 'PM' ? value : null)
                }
                allowDeselect={false}
                size="md"
                required
              />
            </SimpleGrid>
          </Stack>

          <SimpleGrid cols={2} spacing="xs">
            <DatePickerInput
              label="Start date"
              valueFormat="DD MMM YYYY"
              value={from}
              onChange={setFrom}
              size="md"
              clearable={false}
              styles={{
                input: { fontSize: '13.9px' },
              }}
            />

            <Select
              label="Months"
              data={planMonthOptions}
              value={String(months)}
              onChange={(value) => value && setMonths(Number(value))}
              comboboxProps={{ width: 'target' }}
              allowDeselect={false}
              size="md"
            />
          </SimpleGrid>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Payment method
            </Text>

            <SegmentedControl
              color="blue"
              fullWidth
              value={mode}
              onChange={setMode}
              data={[
                { label: 'UPI', value: 'UPI' },
                { label: 'Cash', value: 'Cash' },
              ]}
            />
          </Stack>

          {mode === 'UPI' && (
            <Image
              src="/upi_qr.png"
              alt="UPI payment QR code"
              w={180}
              h={180}
              fit="contain"
              mx="auto"
              className="payment-qr"
            />
          )}

          <Button
            color="orange"
            autoContrast
            fullWidth
            size="md"
            radius="md"
            disabled={
              !name.trim() ||
              !phone.trim() ||
              !address.trim() ||
              !profession.trim() ||
              !visitTime ||
              !endDate ||
              !/^\d{10}$/.test(phone)
            }
            onClick={createMember}
          >
            Create member
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
