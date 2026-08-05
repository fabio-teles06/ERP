'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/hooks/use-supabase';

export default function ShipmentsList() {
    const supabase = useSupabase();
    const [shipments, setShipments] = useState<{ number: string; status: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchShipments() {
            const { data, error } = await supabase
                .from('shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setShipments(data);
            }
            setLoading(false);
        }

        fetchShipments();
    }, [supabase]);

    if (loading) return <h6>Carregando fretes...</h6>;

    return (
        <div>
            <h1>Lista de Fretes</h1>
            <ul>
                {shipments.map((shipment) => (
                    <li key={shipment.number}>
                        {JSON.stringify(shipment)}
                    </li>
                ))}
            </ul>
        </div>
    );
}