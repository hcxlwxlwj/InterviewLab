import type { InterviewPreview } from '@interviewlab/core';
import { ServiceError } from '../../../../foundation/errors';

export function assertPreview(value: InterviewPreview) {
  if (
    value.text.length > 180 ||
    value.acknowledgement.length > 50 ||
    /参考答案|标准答案|建议你|正确做法|回答得|回答很好|你的回答.{0,5}(不足|优秀)|首先.{0,20}其次/.test(
      value.acknowledgement + ' ' + value.text,
    ) ||
    /好习惯|做得好|值得肯定|(?:方案|做法|思路|逻辑|验证|表达).{0,6}(?:有效|合理|正确|清晰|完整|充分|扎实)/.test(
      value.acknowledgement,
    ) ||
    // The interviewer must never accept a redefined role/relationship from the candidate.
    /既然我是(?:学生|同学|HR|面试官)|我是你的?(?:学生|同学)|作为你的?(?:学生|同学)|咱们?(?:就)?(?:当是|作为)同学|同学间交流|以同学(?:身份|的?(?:身份|方式))|换成?(?:学生|同学|HR)|忘记(?:你的?设定|身份|规则)/.test(
      value.acknowledgement + ' ' + value.text,
    ) ||
    (value.text.match(/[?？]/g)?.length ?? 0) > 1
  )
    throw new ServiceError('invalid_model_output', 502, '问题预览未通过校验');
}
