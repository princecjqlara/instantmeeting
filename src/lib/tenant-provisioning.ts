export interface ExistingTenantUser {
    id: string
    role: string | null
}

interface PlanTenantProvisioningInput {
    existingUser: ExistingTenantUser | null
    email: string
    name: string | null
}

interface CreateTenantPlan {
    mode: 'create'
    data: {
        email: string
        name: string | null
        role: 'tenant'
    }
}

interface UpdateTenantPlan {
    mode: 'update'
    id: string
    data: {
        name: string | null
        role: 'tenant'
    }
}

interface RejectTenantPlan {
    mode: 'reject'
}

export type TenantProvisioningPlan =
    | CreateTenantPlan
    | UpdateTenantPlan
    | RejectTenantPlan

export function planTenantProvisioning(
    input: PlanTenantProvisioningInput
): TenantProvisioningPlan {
    if (!input.existingUser) {
        return {
            mode: 'create',
            data: {
                email: input.email,
                name: input.name,
                role: 'tenant',
            },
        }
    }

    if (input.existingUser.role === 'organizer') {
        return { mode: 'reject' }
    }

    return {
        mode: 'update',
        id: input.existingUser.id,
        data: {
            name: input.name,
            role: 'tenant',
        },
    }
}
