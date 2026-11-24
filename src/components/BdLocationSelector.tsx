import {
  getDistrictsByDivision,
  getDivisionNames,
  getUpazilasByDistrict,
} from '../data/bangladeshGeo';

export interface BdLocationValue {
  division: string;
  district: string;
  upazila: string;
  union: string;
  ward: string;
  centerName: string;
  voterAreaCode?: string;
}

interface BdLocationSelectorProps {
  value: BdLocationValue;
  onChange: (next: BdLocationValue) => void;
  requireCenterName?: boolean;
  showAreaCode?: boolean;
  compact?: boolean;
}

export function BdLocationSelector({
  value,
  onChange,
  requireCenterName = true,
  showAreaCode = false,
  compact = false,
}: BdLocationSelectorProps) {
  const divisions = getDivisionNames();
  const districts = value.division ? getDistrictsByDivision(value.division) : [];
  const upazilas =
    value.division && value.district
      ? getUpazilasByDistrict(value.division, value.district)
      : [];

  // Preserve pre-existing custom values if an imported or older record isn't in static list
  const districtOptions =
    value.district && !districts.includes(value.district)
      ? [value.district, ...districts]
      : districts;
  const upazilaOptions =
    value.upazila && !upazilas.includes(value.upazila)
      ? [value.upazila, ...upazilas]
      : upazilas;

  const inputClass = compact
    ? 'w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600'
    : 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600';

  const labelClass = 'block text-xs font-medium text-slate-700 mb-1.5';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className={labelClass}>বিভাগ *</label>
        <select
          required
          value={value.division}
          onChange={(e) =>
            onChange({
              ...value,
              division: e.target.value,
              district: '',
              upazila: '',
            })
          }
          className={inputClass}
        >
          <option value="">বিভাগ নির্বাচন করুন</option>
          {divisions.map((div) => (
            <option key={div} value={div}>
              {div}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>জেলা *</label>
        <select
          required
          disabled={!value.division}
          value={value.district}
          onChange={(e) =>
            onChange({
              ...value,
              district: e.target.value,
              upazila: '',
            })
          }
          className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
        >
          <option value="">
            {value.division ? 'জেলা নির্বাচন করুন' : 'আগে বিভাগ নির্বাচন করুন'}
          </option>
          {districtOptions.map((dist) => (
            <option key={dist} value={dist}>
              {dist}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>উপজেলা / থানা *</label>
        <select
          required
          disabled={!value.district}
          value={value.upazila}
          onChange={(e) =>
            onChange({
              ...value,
              upazila: e.target.value,
            })
          }
          className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
        >
          <option value="">
            {value.district ? 'উপজেলা নির্বাচন করুন' : 'আগে জেলা নির্বাচন করুন'}
          </option>
          {upazilaOptions.map((upz) => (
            <option key={upz} value={upz}>
              {upz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>ইউনিয়ন / পৌরসভা *</label>
        <input
          type="text"
          required
          value={value.union}
          onChange={(e) => onChange({ ...value, union: e.target.value })}
          placeholder="ইউনিয়ন বা পৌরসভার নাম লিখুন"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>ওয়ার্ড নম্বর *</label>
        <input
          type="text"
          required
          value={value.ward}
          onChange={(e) => onChange({ ...value, ward: e.target.value })}
          placeholder="যেমন: ০৪"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          ভোট কেন্দ্র {requireCenterName ? '*' : '(ঐচ্ছিক)'}
        </label>
        <input
          type="text"
          required={requireCenterName}
          value={value.centerName}
          onChange={(e) => onChange({ ...value, centerName: e.target.value })}
          placeholder="ভোট কেন্দ্রের নাম লিখুন"
          className={inputClass}
        />
      </div>

      {showAreaCode && (
        <div>
          <label className={labelClass}>ভোটার এলাকা কোড (ঐচ্ছিক)</label>
          <input
            type="text"
            value={value.voterAreaCode ?? ''}
            onChange={(e) => onChange({ ...value, voterAreaCode: e.target.value })}
            placeholder="যেমন: ০৪৫৬"
            className={`${inputClass} font-mono`}
          />
        </div>
      )}
    </div>
  );
}
