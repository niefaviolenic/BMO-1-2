import { File, Paths } from 'expo-file-system';

import type { SafeUser } from '@/features/auth/domain/types';
import { apiRequest } from '@/lib/api';

import {
  AVATAR_MAX_BYTES,
  avatarUploadFileName,
  resolveAvatarMimeType,
} from '../domain/account/profile';
import type { AvatarUploadInput, ProfilePatchInput } from '../domain/account/types';

type UserResponse = {
  user: SafeUser;
};

type AvatarResponse = {
  avatarUrl: string;
};

function guessFileName(uri: string): string {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const segment = withoutQuery.split('/').pop();
  return segment && segment.length > 0 ? segment : 'avatar.jpg';
}

async function prepareAvatarPart(input: AvatarUploadInput): Promise<{
  part: Blob;
  fileName: string;
}> {
  const source = new File(input.uri);
  if (!source.exists || source.size <= 0) {
    throw new Error('Unable to read the selected photo.');
  }
  if (source.size > AVATAR_MAX_BYTES) {
    throw new Error('Photo is too large. Choose a smaller image.');
  }

  const rawName = input.fileName ?? source.name ?? guessFileName(input.uri);
  const mime = resolveAvatarMimeType(rawName, input.mimeType, source.type);
  const fileName = avatarUploadFileName(mime, rawName);
  const destination = new File(Paths.cache, `joy-avatar-${Date.now()}-${fileName}`);
  await source.copy(destination);

  if (!destination.exists || destination.size <= 0) {
    throw new Error('Unable to read the selected photo.');
  }
  if (destination.size > AVATAR_MAX_BYTES) {
    throw new Error('Photo is too large. Choose a smaller image.');
  }

  const part =
    destination.type === mime
      ? destination
      : destination.slice(0, destination.size, mime);

  return { part, fileName };
}

export async function updateProfile(input: ProfilePatchInput): Promise<SafeUser> {
  const payload = await apiRequest<UserResponse>('/me/profile', {
    method: 'PATCH',
    body: input,
  });
  return payload.user;
}

export async function uploadAvatar(input: AvatarUploadInput): Promise<string> {
  const { part, fileName } = await prepareAvatarPart(input);
  const form = new FormData();
  form.append('file', part, fileName);

  const payload = await apiRequest<AvatarResponse>('/me/avatar', {
    method: 'POST',
    body: form,
  });
  return payload.avatarUrl;
}
