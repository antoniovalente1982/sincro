export interface ClickUpTaskParams {
    name: string;
    description: string;
    assignees?: number[]; // ClickUp user IDs
    tags?: string[];
    priority?: 1 | 2 | 3 | 4; // 1 = Urgent, 4 = Low
    dueDate?: number; // timestamp in MS
}

export async function createClickUpTask(params: ClickUpTaskParams) {
    const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
    const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

    if (!CLICKUP_API_KEY || !CLICKUP_LIST_ID) {
        console.warn('[ClickUp] Credenziali non configurate in .env. Task saltato.');
        return null;
    }

    try {
        const url = `https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': CLICKUP_API_KEY
            },
            body: JSON.stringify({
                name: params.name,
                description: params.description,
                assignees: params.assignees,
                tags: params.tags,
                status: 'TO DO', // Custom status in ClickUp if needed
                priority: params.priority || 3,
                due_date: params.dueDate,
                due_date_time: true,
                notify_all: true,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[ClickUp] Errore API:', err);
            throw new Error(`ClickUp API Error: ${err}`);
        }

        const data = await response.json();
        console.log(`[ClickUp] Task Creato: ${data.id}`);
        return data;

    } catch (error) {
        console.error('[ClickUp] Eccezione durante la creazione del task:', error);
        return null;
    }
}
