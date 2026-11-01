'use client';

import { useMutation, useQuery } from 'convex/react';
import { adminApi } from '../api/admin.api';

export const useAdminLoans = () => useQuery(adminApi.loans, {});

export const useAdminUsers = () => useQuery(adminApi.users, {});

export const useSetTrustedLender = () => useMutation(adminApi.setTrustedLender);

export const useFailedDeliveries = () =>
  useQuery(adminApi.failedDeliveries, {});

export const useRetryDelivery = () => useMutation(adminApi.retryDelivery);
