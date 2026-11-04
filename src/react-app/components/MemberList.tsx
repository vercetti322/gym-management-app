import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { processMemberPhoto } from '../utils/AvatarUtils';
import {
  Accordion,
  Avatar,
  ActionIcon,
  Group,
  Badge,
  Box,
  Select,
  Stack,
  Modal,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconCalendar,
  IconBriefcase,
  IconCoins,
  IconCreditCard,
  IconMapPin,
  IconPhone,
} from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import type { Member } from '../types';
import {
  canRenew,
  formatDate,
  getMemberStatus,
} from '../utils/MemberUtils';
import RenewButton from './UpdatePlan';

function MemberDetail({
  icon,
  label,
  value,
  fullWidth = false,
  editable = true,
  editor,
  onStartEditing,
  onEditorChange,
  onCommit,
  onCancel,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly fullWidth?: boolean;
  readonly editable?: boolean;
  readonly editor?: {
    readonly value: string;
    readonly type: 'text' | 'date' | 'number' | 'select';
    readonly options?: string[];
    readonly clearable?: boolean;
  };
  readonly onStartEditing?: () => void;
  readonly onEditorChange?: (value: string | null) => void;
  readonly onCommit?: (value?: string | null) => void;
  readonly onCancel?: () => void;
}) {
  return (
    <div
      className={`member-detail${fullWidth ? ' member-detail--full' : ''}`}
    >
      <div className="member-detail-heading">
        <span className="member-detail-icon">{icon}</span>
        <Text className="member-detail-label">{label}</Text>
      </div>
      {editor ? (
        editor.type === 'date' ? (
          <DatePickerInput
            className="member-detail-editor"
            aria-label={`Edit ${label}`}
            value={editor.value}
            onChange={(value) => {
              onEditorChange?.(value);
              onCommit?.(value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCancel?.();
            }}
            valueFormat="DD MMM YYYY"
            clearable={false}
            popoverProps={{ withinPortal: true }}
            autoFocus
          />
        ) : editor.type === 'select' ? (
          <Select
            className="member-detail-editor"
            aria-label={`Edit ${label}`}
            data={editor.options ?? []}
            value={editor.value}
            onChange={(value) => {
              onEditorChange?.(value);
              onCommit?.(value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCancel?.();
            }}
            onBlur={() => onCommit?.()}
            autoFocus
            clearable={editor.clearable}
            allowDeselect={editor.clearable}
          />
        ) : (
          <TextInput
            className="member-detail-editor"
            aria-label={`Edit ${label}`}
            type={editor.type}
            value={editor.value}
            onChange={(event) => onEditorChange?.(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onCommit?.();
              } else if (event.key === 'Escape') {
                onCancel?.();
              }
            }}
            onBlur={() => onCommit?.()}
            autoFocus
            min={editor.type === 'number' ? 1 : undefined}
            step={editor.type === 'number' ? 1 : undefined}
          />
        )
      ) : (
        <button
          type="button"
          className={`member-detail-value${editable ? ' member-detail-value--editable' : ''}`}
          onClick={editable ? onStartEditing : undefined}
          aria-label={editable ? `Edit ${label}: ${value}` : undefined}
          disabled={!editable}
        >
          {value}
        </button>
      )}
    </div>
  );
}

type EditableField =
  | 'phone'
  | 'address'
  | 'profession'
  | 'visitTime'
  | 'planMonths'
  | 'startDate'
  | 'price';

type FieldEditor = {
  readonly memberId: number;
  readonly field: EditableField;
  readonly value: string;
};

async function fetchMemberPhoto(id: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/members/${id}/photo`, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) return null;

    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

async function loadMemberPhotos(
  members: Member[],
  onPhotoLoaded: (id: number, url: string) => void,
  isCancelled: () => boolean,
): Promise<void> {
  if (isCancelled() || members.length === 0) return;

  const photos = await Promise.all(
    members.map(async (member) => ({
      id: member.id,
      url: await fetchMemberPhoto(member.id),
    })),
  );

  if (isCancelled()) {
    photos.forEach(({ url }) => {
      if (url) URL.revokeObjectURL(url);
    });
    return;
  }

  photos.forEach(({ id, url }) => {
    if (url) onPhotoLoaded(id, url);
  });
}

export default function MemberList({
  dueOnly,
  members,
  photoRefreshKey,
  onMemberUpdated,
}: {
  readonly dueOnly: boolean;
  readonly members: Member[];
  readonly photoRefreshKey: number;
  readonly onMemberUpdated: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const accordionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<Record<number, string>>(
    {},
  );
  const [photoModalMemberId, setPhotoModalMemberId] = useState<number | null>(
    null,
  );
  const [editingField, setEditingField] = useState<FieldEditor | null>(null);
  const savingFieldRef = useRef(false);

  const q = debouncedQuery.trim().toLowerCase();

  const filtered = members.filter(
    (m) => (!dueOnly || canRenew(m)) && m.name.toLowerCase().includes(q),
  );

  // Display members in ascending ID order.
  const sorted = [...filtered].sort((a, b) => a.id - b.id);

  const onSearch = (value: string) => {
    setQuery(value);
    setOpenId(null);
  };

  const keepExpandedItemInView = (id: string) => {
    if (openId !== id) return;

    const item = accordionItemRefs.current[id];
    if (!item) return;

    const bottomMargin = 16;
    const overflow = item.getBoundingClientRect().bottom -
      (window.innerHeight - bottomMargin);

    if (overflow > 0) {
      window.scrollBy({ top: overflow, behavior: 'smooth' });
    }
  };

  const saveMemberPhoto = async (memberId: number, photo: Blob) => {
    const response = await fetch(`/api/members/${memberId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: photo,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error ?? 'Failed to save photo');
    }
  };

  const saveMemberField = async (valueOverride?: string | null) => {
    const currentEdit = editingField;
    if (currentEdit === null || savingFieldRef.current) return;

    let value: string | null =
      valueOverride === undefined
        ? currentEdit.value.trim()
        : valueOverride?.trim() ?? null;

    if (
      ['planMonths', 'startDate', 'price']
        .includes(currentEdit.field) &&
      !value
    ) {
      alert('This field cannot be empty.');
      return;
    }

    if (
      currentEdit.field === 'address' ||
      currentEdit.field === 'profession' ||
      currentEdit.field === 'visitTime'
    ) {
      value = value || null;
    }

    savingFieldRef.current = true;
    try {
      const response = await fetch(
        `/api/members/${currentEdit.memberId}/details`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field: currentEdit.field,
            value,
          }),
        },
      );

      const data: { message?: string; error?: string } =
        await response.json();

      if (!response.ok) {
        alert(data.error ?? 'Failed to update member details');
        return;
      }

      setEditingField((current) =>
        current?.memberId === currentEdit.memberId &&
          current.field === currentEdit.field
          ? null
          : current,
      );
      await onMemberUpdated();
    } catch {
      alert('Unable to connect to the server. Please try again.');
    } finally {
      savingFieldRef.current = false;
    }
  };

  const updateEditingValue = (value: string | null) => {
    setEditingField((current) =>
      current ? { ...current, value: value ?? '' } : null,
    );
  };

  const photoUrlsRef = useRef<Record<number, string>>({});
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePhotoPreview = useCallback((id: number, url: string) => {
    const oldUrl = photoUrlsRef.current[id];

    if (oldUrl && oldUrl !== url) URL.revokeObjectURL(oldUrl);

    photoUrlsRef.current[id] = url;

    setPhotoPreviews((previous) => ({
      ...previous,
      [id]: url,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const membersWithPhotos = members
      .filter((member) => member.hasPhoto)
      .sort((a, b) => a.id - b.id);

    void loadMemberPhotos(
      membersWithPhotos,
      updatePhotoPreview,
      () => cancelled,
    );

    return () => {
      cancelled = true;
    };
  }, [members, photoRefreshKey, updatePhotoPreview]);

  useEffect(() => {
    if (cleanupTimerRef.current !== null) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        Object.values(photoUrlsRef.current).forEach((url) => {
          URL.revokeObjectURL(url);
        });

        photoUrlsRef.current = {};
        cleanupTimerRef.current = null;
      }, 0);
    };
  }, []);

  return (
    <Stack
      w="100%"
      gap="sm"
      mih={560}
      pb="calc(env(safe-area-inset-bottom, 0px) + 2rem)"
    >
      <TextInput
        placeholder="Search by name"
        value={query}
        onChange={(e) => onSearch(e.currentTarget.value)}
      />

      {sorted.length === 0 && (
        <Text ta="center" c="dimmed">
          {dueOnly ? 'No pending payments' : 'No members found'}
        </Text>
      )}

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];

          const memberId = selectedMemberId;
          input.value = '';

          if (!file || memberId === null) return;

          try {
            const processedPhoto = await processMemberPhoto(file);

            const previewUrl = URL.createObjectURL(processedPhoto);
            updatePhotoPreview(memberId, previewUrl);

            // Save after updating the preview so the UI responds immediately.
            void saveMemberPhoto(memberId, processedPhoto)
              .then(() => onMemberUpdated())
              .catch((error: unknown) => {
                console.error('Photo save failed:', error);
                alert(
                  'Photo could not be saved. It may not persist after refresh.',
                );
              });
          } catch (error) {
            alert(
              error instanceof Error
                ? error.message
                : 'Unable to process or save the photo.',
            );
          }
        }}
      />

      <Modal
        classNames={{
          content: 'photo-preview-modal',
          body: 'photo-preview-modal-body',
        }}
        opened={photoModalMemberId !== null}
        onClose={() => setPhotoModalMemberId(null)}
        withOverlay
        withCloseButton={false}
        padding={0}
        size="auto"
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          color: '#000',
          blur: 3,
        }}
        styles={{
          content: {
            background: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
          body: {
            padding: 0,
          },
          header: {
            display: 'none',
          },
        }}
      >
        {photoModalMemberId !== null && photoPreviews[photoModalMemberId] && (
          <Stack gap="md" align="center">
            <Box
              style={{
                width: 300,
                height: 300,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={photoPreviews[photoModalMemberId]}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                }}
              />
            </Box>

            <button
              type="button"
              onClick={() => {
                setSelectedMemberId(photoModalMemberId);
                photoInputRef.current?.click();
              }}
              className="photo-change-button"
            >
              Change Photo
            </button>
          </Stack>
        )}
      </Modal>

      <Accordion
        variant="separated"
        radius="md"
        value={openId}
        onChange={setOpenId}
        styles={{
          item: {
            border: '1px solid var(--app-border)',
            backgroundColor: 'var(--app-surface)',
          },
          control: {
            backgroundColor: 'var(--app-surface)',
          },
          panel: {
            backgroundColor: 'var(--app-surface)',
          },
        }}
      >
        {sorted.map((m) => {
          const s = getMemberStatus(m);

          let planLabel = 'No plan';

          if (m.planMonths !== null) {
            const unit = m.planMonths === 1 ? 'month' : 'months';
            planLabel = `${m.planMonths} ${unit}`;
          }

          const renderDetail = (
            field: EditableField,
            label: string,
            icon: ReactNode,
            rawValue: string | null,
            displayValue = rawValue ?? '—',
            options?: string[],
            fullWidth = false,
            editable = true,
          ) => {
            const isEditing =
              editingField?.memberId === m.id &&
              editingField.field === field;
            const editorType: NonNullable<
              React.ComponentProps<typeof MemberDetail>['editor']
            >['type'] =
              field === 'startDate'
                ? 'date'
                : field === 'planMonths' || field === 'price'
                  ? 'number'
                  : options
                    ? 'select'
                    : 'text';

            return (
              <MemberDetail
                key={field}
                icon={icon}
                label={label}
                value={displayValue}
                fullWidth={fullWidth}
                editable={editable}
                editor={
                  isEditing && editingField
                    ? {
                        value: editingField.value,
                        type: editorType,
                        options,
                        clearable: field === 'visitTime',
                      }
                    : undefined
                }
                onStartEditing={() => {
                  if (savingFieldRef.current) return;
                  setEditingField({
                    memberId: m.id,
                    field,
                    value: rawValue ?? '',
                  });
                }}
                onEditorChange={updateEditingValue}
                onCommit={(value) => void saveMemberField(value)}
                onCancel={() => setEditingField(null)}
              />
            );
          };

          return (
            <Accordion.Item
              key={m.id}
              value={String(m.id)}
              ref={(element) => {
                if (element) {
                  accordionItemRefs.current[String(m.id)] = element;
                } else {
                  delete accordionItemRefs.current[String(m.id)];
                }
              }}
            >
              <Group
                wrap="nowrap"
                gap={0}
                px="sm"
                className="member-accordion-header"
              >
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  radius="xl"
                  size={68}
                  aria-label={`Add or change ${m.name}'s profile photo`}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (photoPreviews[m.id]) {
                      setPhotoModalMemberId(m.id);
                    } else {
                      setSelectedMemberId(m.id);
                      photoInputRef.current?.click();
                    }
                  }}
                  styles={{
                    root: {
                      backgroundColor: 'transparent',
                      '&:hover': {
                        backgroundColor: 'transparent',
                      },
                    },
                  }}
                  style={{ flexShrink: 0 }}
                >
                  <Avatar
                    src={photoPreviews[m.id] ?? null}
                    alt={`${m.name}'s profile photo`}
                    size={52}
                    radius="50%"
                    color="gray"
                    variant="light"
                    styles={{
                      placeholder: { fontSize: 27.7, fontWeight: 400 },
                    }}
                  >
                    {!photoPreviews[m.id] && '+'}
                  </Avatar>
                </ActionIcon>
                <Accordion.Control
                  style={{ flex: 1, minWidth: 0 }}
                  pl={4}
                  pr="md"
                  py={4}
                >
                  <Stack gap={4} align="flex-start">
                    <Text className="member-accordion-name" fw={700} lineClamp={2}>
                      {m.name}
                    </Text>

                    <Badge
                      color={s.color}
                      variant="light"
                      className={`membership-status membership-status--${s.color}`}
                      size="lg"
                      radius="xl"
                      px="sm"
                      styles={{ root: { alignSelf: 'flex-start' } }}
                    >
                      {s.text}
                    </Badge>
                  </Stack>
                </Accordion.Control>
                <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
                  <RenewButton member={m} onUpdated={onMemberUpdated} />
                </Group>
              </Group>

              <Accordion.Panel
                onTransitionEnd={() =>
                  keepExpandedItemInView(String(m.id))
                }
              >
                <div className="member-details">
                  <div className="member-details-grid">
                    {renderDetail(
                      'phone',
                      'Phone',
                      <IconPhone size={34} stroke={1.8} />,
                      m.phone,
                    )}
                    {renderDetail(
                      'price',
                      'Amount',
                      <IconCoins size={34} stroke={1.8} />,
                      m.price === null ? null : String(m.price),
                      m.price === null
                        ? '—'
                        : new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            maximumFractionDigits: 0,
                          }).format(m.price),
                      undefined,
                      false,
                      m.price !== null,
                    )}
                    {renderDetail(
                      'startDate',
                      'Starts',
                      <IconCalendar size={34} stroke={1.8} />,
                      m.paymentDate,
                      formatDate(m.paymentDate),
                      undefined,
                      false,
                      m.paymentDate !== null,
                    )}
                    {renderDetail(
                      'planMonths',
                      'Plan',
                      <IconCreditCard size={34} stroke={1.8} />,
                      m.planMonths === null ? null : String(m.planMonths),
                      planLabel,
                      Array.from({ length: 12 }, (_, index) =>
                        String(index + 1),
                      ),
                      false,
                      m.planMonths !== null,
                    )}
                    {renderDetail(
                      'profession',
                      'Profession',
                      <IconBriefcase size={34} stroke={1.8} />,
                      m.profession,
                      m.profession || '—',
                    )}
                    {renderDetail(
                      'visitTime',
                      'Usual time',
                      <IconCalendar size={34} stroke={1.8} />,
                      m.visitTime,
                      m.visitTime ?? '—',
                      ['AM', 'PM'],
                    )}
                    {renderDetail(
                      'address',
                      'Address',
                      <IconMapPin size={34} stroke={1.8} />,
                      m.address,
                      m.address || '—',
                      undefined,
                      true,
                    )}
                  </div>
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}
