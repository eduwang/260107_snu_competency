import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

let currentUser = null;
let conversationTableA = null;
let probingQuestionsTableA = null;
let conversationTableB = null;
let probingQuestionsTableB = null;
let lastSelectedRow_conv_a = null;
let lastSelectedRow_prob_a = null;
let lastSelectedRow_conv_b = null;
let lastSelectedRow_prob_b = null;

// Handsontable 초기화 (학생 A)
function initTablesA() {
  const conversationContainer = document.getElementById('conversation-table-a');
  conversationTableA = new Handsontable(conversationContainer, {
    data: [['면접관', ''], ['학생', '']],
    colHeaders: ['발화자', '대화 내용'],
    rowHeaders: true,
    contextMenu: true,
    colWidths: [120, 400],
    minRows: 2,
    minCols: 2,
    licenseKey: 'non-commercial-and-evaluation',
    width: '100%',
    height: 400,
    stretchH: 'all',
    manualRowResize: true,
    manualColumnResize: true,
    autoWrapRow: true,
    autoWrapCol: true,
    autoRowSize: true,
    outsideClickDeselects: false,
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_conv_a = row;
    },
    columns: [
      { 
        data: 0, 
        className: 'htCenter',
        type: 'dropdown',
        source: ['면접관', '학생']
      },
      { 
        data: 1, 
        className: 'htLeft'
      }
    ]
  });

  const probingContainer = document.getElementById('probing-questions-table-a');
  probingQuestionsTableA = new Handsontable(probingContainer, {
    data: [['', '']],
    colHeaders: ['상황', '탐침질문'],
    rowHeaders: true,
    contextMenu: true,
    colWidths: [200, 300],
    minRows: 1,
    minCols: 2,
    licenseKey: 'non-commercial-and-evaluation',
    width: '100%',
    height: 300,
    stretchH: 'all',
    manualRowResize: true,
    manualColumnResize: true,
    autoWrapRow: true,
    autoWrapCol: true,
    autoRowSize: true,
    outsideClickDeselects: false,
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_prob_a = row;
    },
    columns: [
      { 
        data: 0, 
        className: 'htLeft'
      },
      { 
        data: 1, 
        className: 'htLeft'
      }
    ]
  });
}

// Handsontable 초기화 (학생 B)
function initTablesB() {
  const conversationContainer = document.getElementById('conversation-table-b');
  conversationTableB = new Handsontable(conversationContainer, {
    data: [['면접관', ''], ['학생', '']],
    colHeaders: ['발화자', '대화 내용'],
    rowHeaders: true,
    contextMenu: true,
    colWidths: [120, 400],
    minRows: 2,
    minCols: 2,
    licenseKey: 'non-commercial-and-evaluation',
    width: '100%',
    height: 400,
    stretchH: 'all',
    manualRowResize: true,
    manualColumnResize: true,
    autoWrapRow: true,
    autoWrapCol: true,
    autoRowSize: true,
    outsideClickDeselects: false,
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_conv_b = row;
    },
    columns: [
      { 
        data: 0, 
        className: 'htCenter',
        type: 'dropdown',
        source: ['면접관', '학생']
      },
      { 
        data: 1, 
        className: 'htLeft'
      }
    ]
  });

  const probingContainer = document.getElementById('probing-questions-table-b');
  probingQuestionsTableB = new Handsontable(probingContainer, {
    data: [['', '']],
    colHeaders: ['상황', '탐침질문'],
    rowHeaders: true,
    contextMenu: true,
    colWidths: [200, 300],
    minRows: 1,
    minCols: 2,
    licenseKey: 'non-commercial-and-evaluation',
    width: '100%',
    height: 300,
    stretchH: 'all',
    manualRowResize: true,
    manualColumnResize: true,
    autoWrapRow: true,
    autoWrapCol: true,
    autoRowSize: true,
    outsideClickDeselects: false,
    selectionMode: 'single',
    afterSelection: function(row, col, row2, col2) {
      lastSelectedRow_prob_b = row;
    },
    columns: [
      { 
        data: 0, 
        className: 'htLeft'
      },
      { 
        data: 1, 
        className: 'htLeft'
      }
    ]
  });
}

// 메뉴 설정 확인 함수
async function checkMenuAccess(user) {
  if (isAdmin(user.uid)) {
    return true;
  }

  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      
      if (data.probing02 === false) {
        Swal.fire({
          icon: 'error',
          title: '접근 불가',
          text: '이 페이지는 현재 비활성화되어 있습니다.',
          confirmButtonText: '확인'
        }).then(() => {
          window.location.href = '/index.html';
        });
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('메뉴 설정 확인 오류:', error);
    return true;
  }
}

// 인증 상태 확인
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const hasAccess = await checkMenuAccess(user);
    if (!hasAccess) {
      return;
    }

    currentUser = user;
    document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email} 님`;
    document.getElementById('logoutBtn').style.display = 'inline-block';
  } else {
    document.getElementById('userInfo').textContent = '🔐 로그인 후 이용해 주세요.';
    document.getElementById('logoutBtn').style.display = 'none';
    Swal.fire({
      icon: 'warning',
      title: '로그인이 필요합니다',
      text: '메인 페이지로 이동합니다.',
      confirmButtonText: '확인'
    }).then(() => {
      window.location.href = '/index.html';
    });
  }
});

// 메인으로 돌아가기 버튼
const backToMainBtn = document.getElementById('backToMainBtn');
if (backToMainBtn) {
  backToMainBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

// 로그아웃 버튼
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = '/index.html';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '로그아웃 실패',
        text: '로그아웃 중 오류가 발생했습니다.'
      });
    }
  });
}

// 최상단 탭 전환 기능
function initMainTabs() {
  const mainTabButtons = document.querySelectorAll('.main-tab-button');
  const mainTabContents = document.querySelectorAll('.main-tab-content');
  
  mainTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-main-tab');
      
      mainTabButtons.forEach(btn => btn.classList.remove('active'));
      mainTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 하위 탭 전환 기능
function initSubTabs() {
  const subTabButtons = document.querySelectorAll('.sub-tab-button');
  const subTabContents = document.querySelectorAll('.sub-tab-content');
  
  subTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-sub-tab');
      
      subTabButtons.forEach(btn => btn.classList.remove('active'));
      subTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 행 삭제 헬퍼 함수
function deleteRow(table, rowIndex, minRows, lastSelectedRow) {
  if (table.countRows() <= minRows) {
    Swal.fire({
      icon: 'warning',
      title: '알림',
      text: `최소 ${minRows}개의 행이 필요합니다.`
    });
    return;
  }
  
  try {
    table.alter('remove_row', rowIndex);
  } catch (error) {
    console.error('행 삭제 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '삭제 실패',
      text: '행을 삭제하는 중 오류가 발생했습니다: ' + error.message
    });
  }
}

// 행 제어 버튼 초기화 (학생 A)
function initRowControlsA() {
  const addConvBtn = document.getElementById('add-conversation-row-a');
  const delConvBtn = document.getElementById('del-conversation-row-a');
  const addProbingBtn = document.getElementById('add-probing-row-a');
  const delProbingBtn = document.getElementById('del-probing-row-a');
  
  if (!addConvBtn || !delConvBtn || !addProbingBtn || !delProbingBtn) {
    return;
  }
  
  addConvBtn.addEventListener('click', () => {
    try {
      conversationTableA.alter('insert_row', conversationTableA.countRows(), 1);
    } catch (e) {
      try {
        conversationTableA.alter('insert_row_below', conversationTableA.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delConvBtn.addEventListener('click', () => {
    const sel = conversationTableA.getSelected();
    const selLast = conversationTableA.getSelectedLast();
    const selRange = conversationTableA.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_conv_a !== null && lastSelectedRow_conv_a !== undefined) {
      selectedRow = lastSelectedRow_conv_a;
    }
    
    if (selectedRow === null || selectedRow === undefined) {
      Swal.fire({
        title: '삭제할 행 선택',
        text: '삭제할 행 번호를 입력하거나, 테이블에서 행을 클릭한 후 다시 시도해주세요.',
        input: 'number',
        inputPlaceholder: '행 번호 (0부터 시작)',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        inputValidator: (value) => {
          if (!value) {
            return '행 번호를 입력해주세요';
          }
          const rowNum = parseInt(value);
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= conversationTableA.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(conversationTableA, selectedRow, 2, lastSelectedRow_conv_a);
        }
      });
      return;
    }
    
    deleteRow(conversationTableA, selectedRow, 2, lastSelectedRow_conv_a);
  });

  addProbingBtn.addEventListener('click', () => {
    try {
      probingQuestionsTableA.alter('insert_row', probingQuestionsTableA.countRows(), 1);
    } catch (e) {
      try {
        probingQuestionsTableA.alter('insert_row_below', probingQuestionsTableA.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delProbingBtn.addEventListener('click', () => {
    const sel = probingQuestionsTableA.getSelected();
    const selLast = probingQuestionsTableA.getSelectedLast();
    const selRange = probingQuestionsTableA.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_prob_a !== null && lastSelectedRow_prob_a !== undefined) {
      selectedRow = lastSelectedRow_prob_a;
    }
    
    if (selectedRow === null || selectedRow === undefined) {
      Swal.fire({
        title: '삭제할 행 선택',
        text: '삭제할 행 번호를 입력하거나, 테이블에서 행을 클릭한 후 다시 시도해주세요.',
        input: 'number',
        inputPlaceholder: '행 번호 (0부터 시작)',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        inputValidator: (value) => {
          if (!value) {
            return '행 번호를 입력해주세요';
          }
          const rowNum = parseInt(value);
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= probingQuestionsTableA.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(probingQuestionsTableA, selectedRow, 1, lastSelectedRow_prob_a);
        }
      });
      return;
    }
    
    deleteRow(probingQuestionsTableA, selectedRow, 1, lastSelectedRow_prob_a);
  });
}

// 행 제어 버튼 초기화 (학생 B)
function initRowControlsB() {
  const addConvBtn = document.getElementById('add-conversation-row-b');
  const delConvBtn = document.getElementById('del-conversation-row-b');
  const addProbingBtn = document.getElementById('add-probing-row-b');
  const delProbingBtn = document.getElementById('del-probing-row-b');
  
  if (!addConvBtn || !delConvBtn || !addProbingBtn || !delProbingBtn) {
    return;
  }
  
  addConvBtn.addEventListener('click', () => {
    try {
      conversationTableB.alter('insert_row', conversationTableB.countRows(), 1);
    } catch (e) {
      try {
        conversationTableB.alter('insert_row_below', conversationTableB.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delConvBtn.addEventListener('click', () => {
    const sel = conversationTableB.getSelected();
    const selLast = conversationTableB.getSelectedLast();
    const selRange = conversationTableB.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_conv_b !== null && lastSelectedRow_conv_b !== undefined) {
      selectedRow = lastSelectedRow_conv_b;
    }
    
    if (selectedRow === null || selectedRow === undefined) {
      Swal.fire({
        title: '삭제할 행 선택',
        text: '삭제할 행 번호를 입력하거나, 테이블에서 행을 클릭한 후 다시 시도해주세요.',
        input: 'number',
        inputPlaceholder: '행 번호 (0부터 시작)',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        inputValidator: (value) => {
          if (!value) {
            return '행 번호를 입력해주세요';
          }
          const rowNum = parseInt(value);
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= conversationTableB.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(conversationTableB, selectedRow, 2, lastSelectedRow_conv_b);
        }
      });
      return;
    }
    
    deleteRow(conversationTableB, selectedRow, 2, lastSelectedRow_conv_b);
  });

  addProbingBtn.addEventListener('click', () => {
    try {
      probingQuestionsTableB.alter('insert_row', probingQuestionsTableB.countRows(), 1);
    } catch (e) {
      try {
        probingQuestionsTableB.alter('insert_row_below', probingQuestionsTableB.countRows() - 1, 1);
      } catch (e2) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: 'Handsontable 버전 호환 문제가 있습니다.'
        });
      }
    }
  });

  delProbingBtn.addEventListener('click', () => {
    const sel = probingQuestionsTableB.getSelected();
    const selLast = probingQuestionsTableB.getSelectedLast();
    const selRange = probingQuestionsTableB.getSelectedRange();
    
    let selectedRow = null;
    
    if (sel && Array.isArray(sel) && sel.length > 0) {
      selectedRow = sel[0][0];
    } else if (selLast && Array.isArray(selLast) && selLast.length > 0) {
      selectedRow = selLast[0];
    } else if (selRange) {
      selectedRow = selRange.from.row;
    } else if (lastSelectedRow_prob_b !== null && lastSelectedRow_prob_b !== undefined) {
      selectedRow = lastSelectedRow_prob_b;
    }
    
    if (selectedRow === null || selectedRow === undefined) {
      Swal.fire({
        title: '삭제할 행 선택',
        text: '삭제할 행 번호를 입력하거나, 테이블에서 행을 클릭한 후 다시 시도해주세요.',
        input: 'number',
        inputPlaceholder: '행 번호 (0부터 시작)',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        inputValidator: (value) => {
          if (!value) {
            return '행 번호를 입력해주세요';
          }
          const rowNum = parseInt(value);
          if (isNaN(rowNum) || rowNum < 0 || rowNum >= probingQuestionsTableB.countRows()) {
            return '유효한 행 번호를 입력해주세요';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          selectedRow = parseInt(result.value);
          deleteRow(probingQuestionsTableB, selectedRow, 1, lastSelectedRow_prob_b);
        }
      });
      return;
    }
    
    deleteRow(probingQuestionsTableB, selectedRow, 1, lastSelectedRow_prob_b);
  });
}

// 제출 기능 (학생 A)
document.getElementById('submitBtnA').addEventListener('click', async () => {
  await submitData('A', conversationTableA, probingQuestionsTableA, 'studentCharacteristicsA');
});

// 제출 기능 (학생 B)
document.getElementById('submitBtnB').addEventListener('click', async () => {
  await submitData('B', conversationTableB, probingQuestionsTableB, 'studentCharacteristicsB');
});

// 공통 제출 함수
async function submitData(studentType, conversationTable, probingQuestionsTable, characteristicsId) {
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: '로그인 필요',
      text: '로그인이 필요합니다.'
    });
    return;
  }

  const conversationData = conversationTable.getData();
  const probingQuestionsData = probingQuestionsTable.getData();
  const studentCharacteristics = document.getElementById(characteristicsId).value.trim();

  const conversation = [];
  conversationData.forEach(row => {
    if (row[0]?.trim() && row[1]?.trim()) {
      conversation.push({
        speaker: row[0].trim(),
        message: row[1].trim()
      });
    }
  });

  const probingQuestions = [];
  probingQuestionsData.forEach(row => {
    if (row[0]?.trim() || row[1]?.trim()) {
      probingQuestions.push({
        situation: row[0]?.trim() || '',
        question: row[1]?.trim() || ''
      });
    }
  });

  if (conversation.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '대화 입력 필요',
      text: '면접관과 학생의 대화를 입력해주세요.'
    });
    return;
  }

  const validProbingQuestions = probingQuestions.filter(q => q.situation.trim() || q.question.trim());
  if (validProbingQuestions.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '탐침질문 입력 필요',
      text: '상황 또는 탐침질문을 최소 1개 이상 입력해주세요.'
    });
    return;
  }

  const confirmResult = await Swal.fire({
    title: '제출하시겠습니까?',
    text: `학생 ${studentType}의 입력한 내용이 저장되어 공유됩니다.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '제출',
    cancelButtonText: '취소'
  });

  if (!confirmResult.isConfirmed) {
    return;
  }

  Swal.fire({
    title: '제출 중...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const docRef = await addDoc(collection(db, 'probingQuestions'), {
      uid: currentUser.uid,
      displayName: currentUser.displayName || '',
      email: currentUser.email || '',
      createdAt: serverTimestamp(),
      conversation: conversation,
      probingQuestions: probingQuestions,
      studentCharacteristics: studentCharacteristics || '',
      studentType: studentType,
      questionType: 'health_inequality'
    });

    console.log('✅ 저장 완료:', docRef.id);

    Swal.fire({
      icon: 'success',
      title: '제출 완료',
      text: `학생 ${studentType}의 탐침질문이 성공적으로 저장되었습니다!`,
      confirmButtonText: '확인'
    }).then(() => {
      conversationTable.loadData([['면접관', ''], ['학생', '']]);
      probingQuestionsTable.loadData([['', '']]);
      document.getElementById(characteristicsId).value = '';
    });

  } catch (error) {
    console.error('❌ 저장 실패:', error);
    Swal.fire({
      icon: 'error',
      title: '제출 실패',
      text: error.message || '데이터 저장 중 오류가 발생했습니다.'
    });
  }
}

// 불러오기 기능 (학생 A)
async function loadSavedDataA() {
  await loadSavedData('A', conversationTableA, probingQuestionsTableA, 'studentCharacteristicsA');
}

// 불러오기 기능 (학생 B)
async function loadSavedDataB() {
  await loadSavedData('B', conversationTableB, probingQuestionsTableB, 'studentCharacteristicsB');
}

// 공통 불러오기 함수
async function loadSavedData(studentType, conversationTable, probingQuestionsTable, characteristicsId) {
  if (!currentUser) {
    Swal.fire({
      icon: 'warning',
      title: '로그인 필요',
      text: '로그인이 필요합니다.'
    });
    return;
  }

  try {
    Swal.fire({
      title: '불러오는 중...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const q = query(
      collection(db, 'probingQuestions'),
      where('uid', '==', currentUser.uid),
      where('studentType', '==', studentType),
      where('questionType', '==', 'health_inequality')
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      Swal.fire({
        icon: 'info',
        title: '저장된 데이터 없음',
        text: `학생 ${studentType}의 제출한 내용이 없습니다.`
      });
      return;
    }

    const items = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const conversation = data.conversation || [];
      
      let preview = '';
      if (conversation.length > 0) {
        const previewItems = conversation.slice(0, 3);
        preview = previewItems.map(item => `${item.speaker}: ${item.message}`).join(' / ');
        if (conversation.length > 3) {
          preview += ' ...';
        }
      } else {
        preview = '대화 내용 없음';
      }

      items.push({
        id: doc.id,
        data: data,
        createdAt: createdAt,
        preview: preview
      });
    });

    items.sort((a, b) => b.createdAt - a.createdAt);

    const itemsHTML = items.map(item => `
      <div class="load-item" data-id="${item.id}">
        <div class="load-item-header">
          <strong>${item.createdAt.toLocaleString('ko-KR')}</strong>
        </div>
        <div class="load-item-preview">${item.preview}</div>
      </div>
    `).join('');

    Swal.fire({
      title: `학생 ${studentType}의 저장된 내용 불러오기`,
      html: `<div class="load-popup">${itemsHTML}</div>`,
      width: '600px',
      showCancelButton: true,
      confirmButtonText: '닫기',
      cancelButtonText: '취소',
      didOpen: () => {
        document.querySelectorAll('.load-item').forEach(item => {
          item.addEventListener('click', () => {
            const itemId = item.getAttribute('data-id');
            const selectedItem = items.find(i => i.id === itemId);
            if (selectedItem) {
              loadDataIntoForm(selectedItem.data, conversationTable, probingQuestionsTable, characteristicsId);
              Swal.close();
            }
          });
        });
      }
    });

  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 폼에 데이터 채우기
function loadDataIntoForm(data, conversationTable, probingQuestionsTable, characteristicsId) {
  try {
    const conversation = data.conversation || [];
    if (conversation.length > 0) {
      const conversationData = conversation.map(item => [item.speaker, item.message]);
      while (conversationData.length < 2) {
        conversationData.push(['', '']);
      }
      conversationTable.loadData(conversationData);
    } else {
      conversationTable.loadData([['면접관', ''], ['학생', '']]);
    }

    const probingQuestions = data.probingQuestions || [];
    if (probingQuestions.length > 0) {
      const probingData = probingQuestions.map(item => {
        if (typeof item === 'string') {
          return ['', item];
        } else {
          return [item.situation || '', item.question || ''];
        }
      });
      probingQuestionsTable.loadData(probingData);
    } else {
      probingQuestionsTable.loadData([['', '']]);
    }

    const studentCharacteristics = data.studentCharacteristics || '';
    document.getElementById(characteristicsId).value = studentCharacteristics;

    Swal.fire({
      icon: 'success',
      title: '불러오기 완료',
      text: '저장된 내용이 불러와졌습니다!',
      timer: 2000,
      showConfirmButton: false
    });

  } catch (error) {
    console.error('데이터 채우기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '오류',
      text: '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 불러오기 버튼 이벤트
function initLoadButtons() {
  document.getElementById('load-btn-a').addEventListener('click', () => {
    loadSavedDataA();
  });

  document.getElementById('load-btn-b').addEventListener('click', () => {
    loadSavedDataB();
  });
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTablesA();
  initTablesB();
  initMainTabs();
  initSubTabs();
  initRowControlsA();
  initRowControlsB();
  initLoadButtons();
});

