/** MissionApprovalButtons — inline Approve / Reject buttons for mission awaiting-approval messages. */

import { C, R } from '../theme';

interface MissionApprovalButtonsProps {
  missionId: string;
  onResolved: () => void;
}

export default function MissionApprovalButtons({ missionId, onResolved }: MissionApprovalButtonsProps) {
  const handleApprove = async () => {
    await window.vibeflow.missions.resolveApproval({ missionId, approved: true });
    onResolved();
  };
  const handleReject = async () => {
    await window.vibeflow.missions.resolveApproval({ missionId, approved: false });
    onResolved();
  };

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button
        onClick={handleApprove}
        style={{
          padding: '5px 14px',
          backgroundColor: C.greenBg,
          color: C.green,
          border: `1px solid ${C.greenBd}`,
          borderRadius: R.md,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Approve
      </button>
      <button
        onClick={handleReject}
        style={{
          padding: '5px 14px',
          backgroundColor: C.redBg,
          color: C.red,
          border: `1px solid ${C.redBd}`,
          borderRadius: R.md,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Reject
      </button>
    </div>
  );
}
