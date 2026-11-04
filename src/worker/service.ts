import { Context } from 'hono';
import {
  GET_ALL_MEMBERS,
  RENEW_MEMBER_PLAN,
  GET_A_MEMBER,
  MARK_INACTIVE,
  SAVE_MEMBER_PHOTO,
  INSERT_MEMBER,
  GET_MEMBER_PHOTO,
  INSERT_MEMBER_PLAN,
  GET_ACTIVE_MEMBER,
  GET_LATEST_PLAN_TERM,
  PHONE_IN_USE,
  UPDATE_LATEST_PLAN_TERM,
  UPDATE_LATEST_PLAN_PRICE,
  UPDATE_MEMBER_ADDRESS,
  UPDATE_MEMBER_PHONE,
  UPDATE_MEMBER_PROFESSION,
  UPDATE_MEMBER_VISIT_TIME,
} from './queries';
import { MemberRow } from './types';

export const getAllMembers = async (c: Context) => {
  const { results } = await c.env.gym_tracker_db.prepare(GET_ALL_MEMBERS).all();
  c.header('Cache-Control', 'no-store');

  return c.json(
    results.map((row: MemberRow) => ({
      ...row,
      hasPhoto: row.hasPhoto === 1,
      paymentDone: row.paymentDone === 1,
      isActive: row.isActive === 1,
    })),
  );
};

export const createNewMember = async (c: Context) => {
  const {
    name,
    phone,
    startDate,
    endDate,
    planDuration,
    paymentMode,
    address,
    profession,
    visitTime,
  } = await c.req.json<{
    name: string;
    phone: string;
    startDate: string;
    endDate: string;
    planDuration: number;
    paymentMode: 'UPI' | 'Cash' | 'Other';
    address: string;
    profession: string;
    visitTime: 'AM' | 'PM';
  }>();

  if (typeof address !== 'string' || typeof profession !== 'string') {
    return c.json({ error: 'Address and profession are required' }, 400);
  }

  const trimmedAddress = address.trim();
  const trimmedProfession = profession.trim();

  if (!trimmedAddress || trimmedAddress.length > 600) {
    return c.json(
      { error: 'Address is required and must be 600 characters or fewer' },
      400,
    );
  }

  if (!trimmedProfession || trimmedProfession.length > 100) {
    return c.json(
      { error: 'Profession is required and must be 100 characters or fewer' },
      400,
    );
  }

  if (visitTime !== 'AM' && visitTime !== 'PM') {
    return c.json({ error: 'Visit time must be AM or PM' }, 400);
  }

  const price = 1000 + planDuration * 500;
  const db = c.env.gym_tracker_db;

  const results = await db.batch([
    db
      .prepare(INSERT_MEMBER)
      .bind(name, phone, trimmedAddress, trimmedProfession, visitTime),
    db
      .prepare(INSERT_MEMBER_PLAN)
      .bind(planDuration, price, startDate, endDate, paymentMode, phone),
  ]);

  return c.json(
    {
      message: 'Member created successfully',
      memberId: results[0].meta.last_row_id,
    },
    201,
  );
};

export const updateMemberProfile = async (c: Context) => {
  const memberId = Number(c.req.param('id'));
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return c.json({ error: 'Invalid Member ID' }, 400);
  }

  const body = await c.req.json<{ field?: unknown; value?: unknown }>();
  const { field, value } = body;
  const db = c.env.gym_tracker_db;
  const activeMember = await db
    .prepare(GET_ACTIVE_MEMBER)
    .bind(memberId)
    .first();

  if (!activeMember) {
    return c.json({ error: 'Active member not found' }, 404);
  }

  if (
    typeof field !== 'string' ||
    (typeof value !== 'string' && value !== null)
  ) {
    return c.json({ error: 'A valid field and value are required' }, 400);
  }

  const textValue = typeof value === 'string' ? value.trim() : null;
  const planFields = [
    'planMonths',
    'startDate',
    'price',
  ];
  let planTermUpdate:
    | { startDate: string; endDate: string; planDuration: number }
    | undefined;
  let query: string;
  let boundValue: string | number | null;

  if (planFields.includes(field)) {
    const currentPlan = (await db
      .prepare(GET_LATEST_PLAN_TERM)
      .bind(memberId)
      .first()) as {
      startDate: string;
      planDuration: number;
    } | null;

    if (!currentPlan) {
      return c.json({ error: 'Member has no plan to update' }, 404);
    }

    if (field === 'startDate') {
      if (!textValue || !isValidDate(textValue)) {
        return c.json({ error: 'Enter a valid date' }, 400);
      }

      if (!isValidPlanDuration(currentPlan.planDuration)) {
        return c.json({ error: 'Member has an invalid plan duration' }, 400);
      }

      planTermUpdate = {
        startDate: textValue,
        endDate: getPlanEndDate(textValue, currentPlan.planDuration),
        planDuration: currentPlan.planDuration,
      };
      query = UPDATE_LATEST_PLAN_TERM;
      boundValue = null;
    } else if (field === 'planMonths') {
      const months = Number(textValue);
      if (!/^(?:[1-9]|1[0-2])$/.test(textValue ?? '')) {
        return c.json({ error: 'Plan must be between 1 and 12 months' }, 400);
      }
      if (!isValidDate(currentPlan.startDate)) {
        return c.json({ error: 'Member has an invalid start date' }, 400);
      }

      planTermUpdate = {
        startDate: currentPlan.startDate,
        endDate: getPlanEndDate(currentPlan.startDate, months),
        planDuration: months,
      };
      query = UPDATE_LATEST_PLAN_TERM;
      boundValue = null;
    } else if (field === 'price') {
      const price = Number(textValue);
      if (!/^[1-9]\d*$/.test(textValue ?? '') || !Number.isSafeInteger(price)) {
        return c.json({ error: 'Amount must be a positive whole number' }, 400);
      }
      query = UPDATE_LATEST_PLAN_PRICE;
      boundValue = price;
    } else {
      return c.json({ error: 'This field cannot be edited' }, 400);
    }
  } else if (field === 'phone') {
    if (!textValue || textValue.length > 20) {
      return c.json(
        { error: 'Phone is required and must be 20 characters or fewer' },
        400,
      );
    }

    const existingPhone = await db
      .prepare(PHONE_IN_USE)
      .bind(textValue, memberId)
      .first();
    if (existingPhone) {
      return c.json({ error: 'That phone number is already in use' }, 409);
    }

    query = UPDATE_MEMBER_PHONE;
    boundValue = textValue;
  } else if (field === 'address' || field === 'profession') {
    if (field === 'address' && textValue && textValue.length > 600) {
      return c.json({ error: 'Address must be 600 characters or fewer' }, 400);
    }
    if (field === 'profession' && textValue && textValue.length > 100) {
      return c.json({ error: 'Profession must be 100 characters or fewer' }, 400);
    }
    query =
      field === 'address' ? UPDATE_MEMBER_ADDRESS : UPDATE_MEMBER_PROFESSION;
    boundValue = textValue;
  } else if (field === 'visitTime') {
    if (textValue !== null && textValue !== 'AM' && textValue !== 'PM') {
      return c.json({ error: 'Usual time must be AM or PM' }, 400);
    }
    query = UPDATE_MEMBER_VISIT_TIME;
    boundValue = textValue;
  } else {
    return c.json({ error: 'This field cannot be edited' }, 400);
  }

  const statement = db.prepare(query);
  if (planTermUpdate) {
    await statement
      .bind(
        planTermUpdate.startDate,
        planTermUpdate.endDate,
        planTermUpdate.planDuration,
        memberId,
      )
      .run();
  } else {
    await statement.bind(boundValue, memberId).run();
  }
  return c.json({ message: 'Member field updated successfully' });
};

function isValidPlanDuration(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function getPlanEndDate(startDate: string, months: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const totalMonths = year * 12 + month - 1 + months;
  const endYear = Math.floor(totalMonths / 12);
  const endMonth = (totalMonths % 12) + 1;
  const endDay = Math.min(
    day,
    new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate(),
  );

  return `${String(endYear).padStart(4, '0')}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export const renewMemberPlan = async (c: Context) => {
  const memberId = Number(c.req.param('id'));
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return c.json({ error: 'Invalid Member ID' }, 400);
  }

  const { startDate, endDate, planDuration, paymentMode } = await c.req.json<{
    startDate: string;
    endDate: string;
    planDuration: number;
    paymentMode: 'UPI' | 'Cash' | 'Other';
  }>();

  const price = 1000 + planDuration * 500;
  const result = await c.env.gym_tracker_db
    .prepare(RENEW_MEMBER_PLAN)
    .bind(memberId, planDuration, price, startDate, endDate, paymentMode)
    .run();

  return c.json(
    {
      message: 'Member plan renewed successfully',
      auditId: result.meta.last_row_id,
    },
    201,
  );
};

export const updateMemberDetails = async (c: Context) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid Member ID' }, 400);
  }

  const result = await c.env.gym_tracker_db
    .prepare(MARK_INACTIVE)
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Member not found' }, 404);
  }

  return c.json({ message: 'Member marked inactive successfully!' }, 200);
};

export const getMember = async (c: Context) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid Member ID' }, 400);
  }

  const result = (await c.env.gym_tracker_db
    .prepare(GET_A_MEMBER)
    .bind(id)
    .first()) as MemberRow | null;

  if (!result) {
    return c.json({ error: 'Member not found' }, 404);
  }

  return c.json({
    ...result,
    paymentDone: result.paymentDone === 1,
    isActive: result.isActive === 1,
  });
};

export const saveMemberPhoto = async (c: Context) => {
  const id = Number(c.req.param('id'));

  if (!Number.isSafeInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid Member ID' }, 400);
  }

  const contentType = c.req.header('content-type')?.trim().toLowerCase();

  console.log('Received photo Content-Type:', contentType);

  if (contentType !== 'image/jpeg') {
    return c.json(
      {
        error: `Expected image/jpeg, received: ${contentType ?? 'missing'}`,
      },
      415,
    );
  }

  const contentLength = Number(c.req.header('content-length'));

  if (contentLength > 1024 * 1024) {
    return c.json({ error: 'Photo exceeds the 1 MB limit' }, 413);
  }

  const photo = await c.req.arrayBuffer();

  if (photo.byteLength === 0) {
    return c.json({ error: 'Photo cannot be empty' }, 400);
  }

  if (photo.byteLength > 1024 * 1024) {
    return c.json({ error: 'Photo exceeds the 1 MB limit' }, 413);
  }

  const result = await c.env.gym_tracker_db
    .prepare(SAVE_MEMBER_PHOTO)
    .bind(new Uint8Array(photo), id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Active member not found' }, 404);
  }

  return c.json({ message: 'Photo saved successfully' });
};

export const getMemberPhoto = async (c: Context) => {
  const id = Number(c.req.param('id'));

  if (!Number.isSafeInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid Member ID' }, 400);
  }

  const result = (await c.env.gym_tracker_db
    .prepare(GET_MEMBER_PHOTO)
    .bind(id)
    .first()) as { photo_data: number[] | null } | null;

  if (!result?.photo_data) {
    return c.json({ error: 'Member photo not found' }, 404);
  }

  const bytes = new Uint8Array(result.photo_data);

  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
