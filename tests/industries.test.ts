import { INDUSTRY_PICKER, getIndustryExperience, getIndustryOptions } from "../src/lib/industry-experiences";
let bad=0;
for (const i of INDUSTRY_PICKER){const e=getIndustryExperience(i.label); if(e?.id!==i.experienceId){bad++;console.log("MISMATCH",i.label,e?.id)}}
console.log(getIndustryOptions().length,"options, mismatches",bad);
