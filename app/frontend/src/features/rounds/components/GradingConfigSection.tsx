'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  calculateWeightedScore,
  classifyScore,
  GRADE_CLASSIFICATIONS,
  type Round,
  type UpdateRoundGradingInput,
} from '@/types/round';
import type { RoundService } from '@/features/rounds/services/roundService';

interface GradingConfigSectionProps {
  round: Round;
  roundService: RoundService;
  onChanged: (round: Round) => void;
}

export const GradingConfigSection: React.FC<GradingConfigSectionProps> = ({
  round,
  roundService,
  onChanged,
}) => {
  const isDraft = round.status === 'Nháp';

  const [weightChair, setWeightChair] = useState(
    round.grading?.weightChair ?? 1,
  );
  const [weightSecretary, setWeightSecretary] = useState(
    round.grading?.weightSecretary ?? 1,
  );
  const [weightSupervisor, setWeightSupervisor] = useState(
    round.grading?.weightSupervisor ?? 2,
  );
  const [weightReviewer, setWeightReviewer] = useState(
    round.grading?.weightReviewer ?? 2,
  );
  const [deviationThreshold, setDeviationThreshold] = useState(
    round.grading?.deviationThreshold ?? 2.0,
  );
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [confirmingDefault, setConfirmingDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Validate
  const isValidWeight = (w: number) => !isNaN(w) && w > 0 && w <= 10;
  const isValidThreshold = (t: number) => !isNaN(t) && t > 0 && t <= 10;
  const formValid =
    isValidWeight(weightChair) &&
    isValidWeight(weightSecretary) &&
    isValidWeight(weightSupervisor) &&
    isValidWeight(weightReviewer) &&
    isValidThreshold(deviationThreshold);

  // Example calculation
  const sampleScores = { chair: 8.0, secretary: 7.0, supervisor: 9.0, reviewer: 6.0 };
  const exampleScore = calculateWeightedScore(sampleScores, {
    weightChair: isValidWeight(weightChair) ? weightChair : 1,
    weightSecretary: isValidWeight(weightSecretary) ? weightSecretary : 1,
    weightSupervisor: isValidWeight(weightSupervisor) ? weightSupervisor : 2,
    weightReviewer: isValidWeight(weightReviewer) ? weightReviewer : 2,
  });
  const exampleGrade = classifyScore(exampleScore);

  const handleSave = async (confirmedDefault = false) => {
    if (!formValid || saving || !isDraft) return;

    if (saveAsDefault && !confirmedDefault) {
      setConfirmingDefault(true);
      return;
    }

    setSaving(true);
    try {
      const input: UpdateRoundGradingInput = {
        weightChair,
        weightSecretary,
        weightSupervisor,
        weightReviewer,
        deviationThreshold,
        saveAsProgramDefault: saveAsDefault,
      };
      const updated = await roundService.saveGrading(round.id, input);
      toast.success(
        saveAsDefault
          ? `Đã lưu cấu hình điểm và cập nhật mặc định cho chương trình ${round.program}.`
          : 'Đã lưu cấu hình điểm của đợt.',
      );
      onChanged(updated);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Không thể lưu cấu hình điểm.';
      toast.error(msg);
    } finally {
      setSaving(false);
      setConfirmingDefault(false);
    }
  };

  return (
    <div className="rnd-grading-section" aria-label="Cấu hình điểm">
      {!isDraft && (
        <div role="note" className="rnd-note rnd-note-info">
          Đợt đã mở, không sửa cấu hình điểm. Cấu hình điểm chỉ được sửa khi đợt
          còn ở trạng thái Nháp.
        </div>
      )}

      <div className="rnd-grading-grid">
        <section className="app-card rnd-grading-card" aria-labelledby="weights-heading">
          <h3 id="weights-heading" className="rnd-section-title">
            Hệ số tính điểm khóa luận
          </h3>
          <p className="app-muted rnd-section-desc">
            Điểm tổng kết khóa luận được tính bằng trung bình có trọng số của 4
            điểm thành phần. Mỗi hệ số từ 0.1 đến 10.
          </p>

          <div className="rnd-fields-row">
            <div className="rnd-field">
              <label htmlFor="w-chair">Chủ tịch hội đồng</label>
              <input
                id="w-chair"
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                disabled={!isDraft || saving}
                value={weightChair}
                onChange={(e) => setWeightChair(parseFloat(e.target.value))}
              />
            </div>
            <div className="rnd-field">
              <label htmlFor="w-sec">Thư ký hội đồng</label>
              <input
                id="w-sec"
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                disabled={!isDraft || saving}
                value={weightSecretary}
                onChange={(e) => setWeightSecretary(parseFloat(e.target.value))}
              />
            </div>
            <div className="rnd-field">
              <label htmlFor="w-sup">GV hướng dẫn</label>
              <input
                id="w-sup"
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                disabled={!isDraft || saving}
                value={weightSupervisor}
                onChange={(e) => setWeightSupervisor(parseFloat(e.target.value))}
              />
            </div>
            <div className="rnd-field">
              <label htmlFor="w-rev">GV phản biện</label>
              <input
                id="w-rev"
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                disabled={!isDraft || saving}
                value={weightReviewer}
                onChange={(e) => setWeightReviewer(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="rnd-field rnd-field-single">
            <label htmlFor="dev-thresh">Ngưỡng lệch điểm cần chú ý</label>
            <div className="rnd-input-hint-row">
              <input
                id="dev-thresh"
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                disabled={!isDraft || saving}
                value={deviationThreshold}
                onChange={(e) => setDeviationThreshold(parseFloat(e.target.value))}
              />
              <span className="app-muted">
                (Đề tài có điểm thành phần lệch so với điểm KL từ {deviationThreshold} điểm trở lên sẽ được gắn cờ)
              </span>
            </div>
          </div>

          <div className="rnd-example-box">
            <h4>Ví dụ tính điểm</h4>
            <p>
              Giả sử điểm các thành viên: CT = <b>8.0</b>, TK = <b>7.0</b>, HD = <b>9.0</b>, PB = <b>6.0</b>
            </p>
            <p className="rnd-example-result">
              Điểm khóa luận ={' '}
              <code>
                (8×{weightChair} + 7×{weightSecretary} + 9×{weightSupervisor} + 6×{weightReviewer}) / ({weightChair}+{weightSecretary}+{weightSupervisor}+{weightReviewer})
              </code>{' '}
              = <b>{exampleScore.toFixed(2)}</b> &rarr; Xếp loại: <b>{exampleGrade}</b>
            </p>
          </div>

          {isDraft && (
            <div className="rnd-grading-actions">
              <label className="rnd-check-label">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  disabled={saving}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                />
                <span>Lưu làm mặc định cho các đợt mới của chương trình {round.program}</span>
              </label>

              <button
                type="button"
                className="app-button app-button-primary"
                disabled={!formValid || saving}
                onClick={() => void handleSave(false)}
              >
                {saving ? 'Đang lưu...' : 'Lưu cấu hình điểm'}
              </button>
            </div>
          )}
        </section>

        <section className="app-card rnd-grading-info" aria-labelledby="rules-heading">
          <h3 id="rules-heading" className="rnd-section-title">
            Quy định chấm & Xếp loại
          </h3>
          <div className="rnd-rule-item">
            <b>Quy tắc làm tròn:</b>
            <p>Điểm khóa luận được làm tròn đến 2 chữ số thập phân theo quy tắc làm tròn nửa lên (Round half up).</p>
          </div>

          <div className="rnd-rule-item">
            <b>Bảng xếp loại khóa luận tốt nghiệp:</b>
            <table className="app-table rnd-tier-table">
              <thead>
                <tr>
                  <th scope="col">Mức điểm</th>
                  <th scope="col">Xếp loại</th>
                </tr>
              </thead>
              <tbody>
                {GRADE_CLASSIFICATIONS.map((c) => (
                  <tr key={c.label}>
                    <td>
                      {c.min === 0
                        ? '< 5.00'
                        : c.min === 9.0
                          ? '≥ 9.00'
                          : `≥ ${c.min.toFixed(2)}`}
                    </td>
                    <td>
                      <b>{c.label}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {confirmingDefault && (
        <ConfirmDialog
          title="Xác nhận lưu cấu hình mặc định"
          description={`Bạn có chắc chắn muốn lưu cấu hình hệ số điểm này làm mặc định cho tất cả các đợt tạo mới của chương trình ${round.program}?`}
          confirmLabel="Lưu mặc định"
          cancelLabel="Hủy"
          onCancel={() => setConfirmingDefault(false)}
          onConfirm={() => void handleSave(true)}
        />
      )}
    </div>
  );
};
