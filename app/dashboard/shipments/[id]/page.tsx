"use client";

import { Suspense, useState, useEffect } from 'react';
import { useSupabase } from '@/hooks/use-supabase';

export default async function ShipmentsList({ params }: { params: Promise<{ id: string }> }) {
    const supabase = useSupabase();
    const { id } = await params;

    const [loading, setLoading] = useState<boolean>(true);
    const [shipment, setShipment] = useState<{ number: string; status: string } | null>(null);

    useEffect(() => {
        async function fetchShipments() {
            const { data, error } = await supabase.from('shipments').select('*')
                .eq('id', id)
                .single();


            if (!error && data) {
                setShipment(data);
            }
            setLoading(false);
        }

        fetchShipments();
    }, [supabase]);

    if (loading) return <h6>Carregando fretes...</h6>;

    return (
        <div>
            <h1>Detalhes do Frete {id}</h1>
            <p>{JSON.stringify(shipment)}</p>
        </div>
    );
}