import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  assignBed,
  getBeds,
  releaseBed,
  reserveBed,
  setBedStatus,
} from '../../api/beds.js';
import {
  acceptEmergency,
  closeEmergency,
  getEmergencies,
  reserveEmergencyBed,
} from '../../api/emergency.js';
import { connectStaffSocket } from '../../api/realtime.js';
import Spinner from '../../components/Spinner.jsx';
import Toast from '../../components/Toast.jsx';

const titleCase = (value) => value.toLowerCase().replaceAll('_', ' ');
const dateTime = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export default function PhaseFourPanel() {
  const client = useQueryClient();
  const { accessToken } = useAuth();
  const [selections, setSelections] = useState({});
  const [patientPhone, setPatientPhone] = useState('');
  const [liveAlert, setLiveAlert] = useState(null);
  const [connected, setConnected] = useState(false);
  const beds = useQuery({ queryKey: ['beds'], queryFn: getBeds });
  const emergencies = useQuery({
    queryKey: ['emergencies'],
    queryFn: getEmergencies,
  });
  const refreshBeds = () => client.invalidateQueries({ queryKey: ['beds'] });
  const refreshEmergencies = () =>
    client.invalidateQueries({ queryKey: ['emergencies'] });
  const actions = {
    reserve: useMutation({ mutationFn: reserveBed, onSuccess: refreshBeds }),
    assign: useMutation({
      mutationFn: ({ bedId, body }) => assignBed(bedId, body),
      onSuccess: () => {
        refreshBeds();
        refreshEmergencies();
      },
    }),
    release: useMutation({ mutationFn: releaseBed, onSuccess: refreshBeds }),
    status: useMutation({
      mutationFn: ({ id, next }) => setBedStatus(id, next),
      onSuccess: refreshBeds,
    }),
    accept: useMutation({
      mutationFn: acceptEmergency,
      onSuccess: refreshEmergencies,
    }),
    reserveForCase: useMutation({
      mutationFn: ({ caseId, bedId }) => reserveEmergencyBed(caseId, bedId),
      onSuccess: () => {
        refreshBeds();
        refreshEmergencies();
      },
    }),
    close: useMutation({
      mutationFn: closeEmergency,
      onSuccess: refreshEmergencies,
    }),
  };
  const mutationError = Object.values(actions).find(
    (action) => action.isError,
  )?.error;

  useEffect(() => {
    if (!accessToken) return undefined;
    const socket = connectStaffSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('bed.counts', () => refreshBeds());
    socket.on('emergency.raised', (alert) => {
      setLiveAlert(alert);
      refreshEmergencies();
      window.setTimeout(
        () =>
          setLiveAlert((current) =>
            current?.id === alert.id ? null : current,
          ),
        12_000,
      );
    });
    return () => socket.disconnect();
  }, [accessToken]);

  const flatBeds =
    beds.data?.flatMap((group) => group.wards.flatMap((ward) => ward.beds)) ??
    [];
  const availableBeds = flatBeds.filter(
    (bed) =>
      bed.status === 'AVAILABLE' ||
      (bed.status === 'RESERVED' &&
        bed.reservedUntil > new Date().toISOString()),
  );

  return (
    <section className="space-y-8" aria-label="Beds and emergency dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Live hospital operations
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            Beds and emergencies
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
        >
          {connected ? 'Live connection' : 'Connecting to live updates…'}
        </span>
      </div>
      {liveAlert && (
        <div
          key={liveAlert.id}
          role="alert"
          aria-live="assertive"
          className="animate-pulse rounded-2xl border-2 border-rose-500 bg-rose-50 p-5"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-rose-800">
            New emergency · {liveAlert.severity}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ink">
            Case {liveAlert.id.slice(0, 8)} — {liveAlert.location}
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Open the emergency dashboard for case details.
          </p>
        </div>
      )}
      {mutationError && (
        <Toast
          message={
            mutationError?.response?.data?.message ??
            'That hospital operation could not be completed.'
          }
        />
      )}

      <section>
        <h3 className="text-lg font-semibold text-ink">Bed inventory</h3>
        {beds.isLoading && (
          <div className="mt-3">
            <Spinner label="Loading bed inventory" />
          </div>
        )}
        {beds.isError && (
          <div className="mt-3">
            <Toast message="Bed inventory could not be loaded." />
          </div>
        )}
        {beds.data?.every((group) => group.total === 0) && (
          <p className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-600">
            No wards or beds are configured.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {beds.data?.map((group) => (
            <article
              key={group.type}
              className="rounded-2xl border border-emerald-950/10 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold capitalize text-ink">
                  {titleCase(group.type)}
                </h4>
                <span className="text-sm font-semibold text-forest">
                  {group.available}/{group.total} available
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Occupied {group.occupied} · Reserved {group.reserved} · Cleaning{' '}
                {group.cleaning} · Out of service {group.outOfService}
              </p>
              <div className="mt-3 space-y-2">
                {group.wards.flatMap((ward) =>
                  ward.beds.map((bed) => (
                    <div
                      key={bed.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold capitalize text-ink">
                          {ward.name} · {bed.bedNumber}
                        </p>
                        <p className="text-xs capitalize text-slate-600">
                          {titleCase(bed.status)}
                          {bed.reservedUntil
                            ? ` until ${dateTime(bed.reservedUntil)}`
                            : ''}
                        </p>
                        {bed.assignments[0]?.emergencyCase && (
                          <p className="text-xs text-rose-800">
                            {bed.assignments[0].emergencyCase.name} ·{' '}
                            {bed.assignments[0].emergencyCase.severity}
                          </p>
                        )}
                        {bed.assignments[0]?.patient && (
                          <p className="text-xs text-slate-600">
                            {bed.assignments[0].patient.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {bed.status === 'AVAILABLE' && (
                          <>
                            <button
                              type="button"
                              disabled={!patientPhone}
                              onClick={() =>
                                actions.assign.mutate({
                                  bedId: bed.id,
                                  body: { phone: patientPhone },
                                })
                              }
                              className="rounded-lg bg-forest px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Assign
                            </button>
                            <button
                              type="button"
                              onClick={() => actions.reserve.mutate(bed.id)}
                              className="rounded-lg border border-forest px-2 py-1 text-xs font-semibold text-forest"
                            >
                              Reserve
                            </button>
                          </>
                        )}
                        {bed.status === 'OCCUPIED' && (
                          <button
                            type="button"
                            onClick={() => actions.release.mutate(bed.id)}
                            className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-900"
                          >
                            Release
                          </button>
                        )}
                        {['CLEANING', 'OUT_OF_SERVICE', 'RESERVED'].includes(
                          bed.status,
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              actions.status.mutate({
                                id: bed.id,
                                next: 'AVAILABLE',
                              })
                            }
                            className="rounded-lg border border-forest px-2 py-1 text-xs font-semibold text-forest"
                          >
                            Mark available
                          </button>
                        )}
                      </div>
                    </div>
                  )),
                )}
              </div>
            </article>
          ))}
        </div>
        {availableBeds.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4">
            <label className="text-sm font-medium text-ink">
              Assign a patient by phone
              <input
                value={patientPhone}
                onChange={(event) => setPatientPhone(event.target.value)}
                placeholder="Phone used for registration"
                className="mt-1 block w-72 max-w-full rounded-xl border border-emerald-950/15 px-3 py-2 font-normal"
              />
            </label>
            <span className="text-xs text-slate-500">
              Emergency cases can be assigned from their dashboard row.
            </span>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink">
            Emergency dashboard
          </h3>
          <span className="text-xs text-slate-600">
            Live, sound-free alerts
          </span>
        </div>
        {emergencies.isLoading && (
          <div className="mt-3">
            <Spinner label="Loading emergencies" />
          </div>
        )}
        {emergencies.isError && (
          <div className="mt-3">
            <Toast message="Emergency cases could not be loaded." />
          </div>
        )}
        {emergencies.data?.length === 0 && (
          <p className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-600">
            No active emergency cases.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {emergencies.data?.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border bg-white p-4 ${item.severity === 'CRITICAL' ? 'border-rose-400 ring-1 ring-rose-200' : 'border-emerald-950/10'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-rose-800">
                    {item.severity} · {titleCase(item.status)}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-ink">
                    {item.name} · {item.phone}
                  </h4>
                  <p className="mt-1 text-sm text-slate-700">
                    {item.complaint}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {item.location} · {dateTime(item.createdAt)}
                  </p>
                  {item.bedAssignments.map((assignment) => (
                    <p
                      key={assignment.id}
                      className="mt-2 text-sm font-semibold text-forest"
                    >
                      {assignment.bed.ward.name}, bed {assignment.bed.bedNumber}{' '}
                      · {titleCase(assignment.bed.status)}
                    </p>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status === 'RAISED' && (
                    <button
                      type="button"
                      onClick={() => actions.accept.mutate(item.id)}
                      className="rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white"
                    >
                      Accept
                    </button>
                  )}
                  {item.status === 'ACCEPTED' && (
                    <>
                      <select
                        aria-label={`Bed for ${item.name}`}
                        value={selections[item.id] ?? ''}
                        onChange={(event) =>
                          setSelections({
                            ...selections,
                            [item.id]: event.target.value,
                          })
                        }
                        className="rounded-xl border border-emerald-950/15 px-2 py-2 text-xs"
                      >
                        <option value="">Choose bed</option>
                        {flatBeds
                          .filter(
                            (bed) =>
                              bed.status === 'AVAILABLE' ||
                              bed.assignments.some(
                                (assignment) =>
                                  assignment.emergencyCase?.id === item.id,
                              ),
                          )
                          .map((bed) => (
                            <option key={bed.id} value={bed.id}>
                              {bed.ward.name} · {bed.bedNumber} (
                              {titleCase(bed.status)})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selections[item.id]}
                        onClick={() =>
                          actions.reserveForCase.mutate({
                            caseId: item.id,
                            bedId: selections[item.id],
                          })
                        }
                        className="rounded-xl border border-forest px-3 py-2 text-xs font-semibold text-forest disabled:opacity-50"
                      >
                        Reserve bed
                      </button>
                      <button
                        type="button"
                        disabled={!selections[item.id]}
                        onClick={() =>
                          actions.assign.mutate({
                            bedId: selections[item.id],
                            body: { emergencyCaseId: item.id },
                          })
                        }
                        className="rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Assign bed
                      </button>
                    </>
                  )}
                  {['RAISED', 'ACCEPTED', 'ADMITTED'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => actions.close.mutate(item.id)}
                      className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
