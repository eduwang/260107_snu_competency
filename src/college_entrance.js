import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

let currentUser = null;
let criteriaTables = {}; // 평가 기준 테이블들

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

// 제시문 탭 전환 기능
function initDocumentTabs() {
  const documentTabButtons = document.querySelectorAll('.document-tab-button');
  const documentTabContents = document.querySelectorAll('.document-tab-content');
  
  documentTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetDocument = button.getAttribute('data-document');
      
      documentTabButtons.forEach(btn => btn.classList.remove('active'));
      documentTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`document-${targetDocument}-content`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 질문별 탭 전환 기능
function initQuestionTabs() {
  const questionTabButtons = document.querySelectorAll('.question-tab-button');
  const questionTabContents = document.querySelectorAll('.question-tab-content');
  
  questionTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetQuestion = button.getAttribute('data-question');
      
      questionTabButtons.forEach(btn => btn.classList.remove('active'));
      questionTabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.getElementById(`question-${targetQuestion}-content`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 평가 기준 Handsontable 초기화
function initCriteriaTables() {
  // 질문별 평가 기준 데이터
  const criteriaData = {
    1: [['역량', '평가 기준']],
    2: [['역량', '평가 기준']],
    3: [['역량', '평가 기준']]
  };

  // 질문 1~3 평가 기준 테이블 초기화
  for (let i = 1; i <= 3; i++) {
    const container = document.getElementById(`criteria-table-${i}`);
    if (container) {
      const data = criteriaData[i] || [['역량', '평가 기준']];
      criteriaTables[i] = new Handsontable(container, {
        data: data,
        colHeaders: ['역량', '평가 기준'],
        rowHeaders: true,
        contextMenu: true,
        colWidths: [150, 400],
        minRows: 1,
        minCols: 2,
        licenseKey: 'non-commercial-and-evaluation',
        width: '100%',
        height: 200,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        autoWrapRow: true,
        autoWrapCol: true,
        columns: [
          {
            data: 0,
            className: 'htCenter',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              td.style.fontWeight = 'bold';
              td.style.textAlign = 'center';
            }
          },
          {
            data: 1,
            className: 'htLeft',
            renderer: function(instance, td, row, col, prop, value, cellProperties) {
              Handsontable.renderers.TextRenderer.apply(this, arguments);
              // MathJax 렌더링을 위해 텍스트를 그대로 유지
            }
          }
        ],
        afterRender: function() {
          // Handsontable 렌더링 후 MathJax 실행
          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([container]).catch(function(err) {
              console.error('MathJax typeset error:', err);
            });
          }
        }
      });
    }
  }

  // 종합 평가 기준 테이블 초기화
  const summaryContainer = document.getElementById('summary-criteria-table');
  if (summaryContainer) {
    criteriaTables['summary'] = new Handsontable(summaryContainer, {
      data: [['역량', '평가 기준']],
      colHeaders: ['역량', '평가 기준'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [150, 400],
      minRows: 1,
      minCols: 2,
      licenseKey: 'non-commercial-and-evaluation',
      width: '100%',
      height: 200,
      stretchH: 'all',
      manualRowResize: true,
      manualColumnResize: true,
      autoWrapRow: true,
      autoWrapCol: true,
      columns: [
        {
          data: 0,
          className: 'htCenter',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.fontWeight = 'bold';
            td.style.textAlign = 'center';
          }
        },
        {
          data: 1,
          className: 'htLeft'
        }
      ],
      afterRender: function() {
        // Handsontable 렌더링 후 MathJax 실행
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([summaryContainer]).catch(function(err) {
            console.error('MathJax typeset error:', err);
          });
        }
      }
    });
  }

  // 탐침 질문 테이블 초기화
  const probingContainer = document.getElementById('probing-questions-table');
  if (probingContainer) {
    criteriaTables['probing'] = new Handsontable(probingContainer, {
      data: [['상황', '탐침 질문']],
      colHeaders: ['상황', '탐침 질문'],
      rowHeaders: true,
      contextMenu: true,
      colWidths: [200, 400],
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
      columns: [
        {
          data: 0,
          className: 'htLeft',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.fontWeight = 'bold';
          }
        },
        {
          data: 1,
          className: 'htLeft',
          renderer: function(instance, td, row, col, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            if (value) {
              // bullet 처리
              const lines = value.split('\n').filter(line => line.trim());
              if (lines.length > 0) {
                td.innerHTML = '<ul style="margin: 0; padding-left: 1.5rem;">' +
                  lines.map(line => `<li>${line.trim()}</li>`).join('') +
                  '</ul>';
              }
            }
          }
        }
      ],
      afterRender: function() {
        // Handsontable 렌더링 후 MathJax 실행
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([probingContainer]).catch(function(err) {
            console.error('MathJax typeset error:', err);
          });
        }
      }
    });
  }
}

// 탐침 질문 크게 보기 버튼
function initViewProbingQuestionsBtn() {
  const viewBtn = document.getElementById('view-probing-questions-btn');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      const probingTable = criteriaTables['probing'];
      if (!probingTable) return;

      const data = probingTable.getData();
      let html = '<div style="text-align: left;">';
      html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">';
      html += '<thead><tr style="background: #e5e7eb;"><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left; width: 30%;">상황</th><th style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left;">탐침 질문</th></tr></thead>';
      html += '<tbody>';

      data.forEach(row => {
        if (row[0] || row[1]) {
          html += '<tr>';
          html += `<td style="padding: 0.5rem; border: 1px solid #d1d5db; font-weight: bold;">${row[0] || ''}</td>`;
          const questionText = row[1] || '';
          const lines = questionText.split('\n').filter(line => line.trim());
          const bulletList = lines.length > 0 
            ? '<ul style="margin: 0; padding-left: 1.5rem; text-align: left;">' + lines.map(line => `<li>${line.trim()}</li>`).join('') + '</ul>'
            : questionText;
          html += `<td style="padding: 0.5rem; border: 1px solid #d1d5db; text-align: left;">${bulletList}</td>`;
          html += '</tr>';
        }
      });

      html += '</tbody></table>';
      html += '</div>';

      Swal.fire({
        title: '탐침 질문',
        html: html,
        width: '900px',
        showConfirmButton: true,
        confirmButtonText: '닫기',
        didOpen: () => {
          // 팝업이 열린 후 MathJax 실행
          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch(function(err) {
              console.error('MathJax typeset error:', err);
            });
          }
        }
      });
    });
  }
}

// 이미지 팝업 기능
function initImagePopups() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('document-image')) {
      const imgSrc = e.target.src;
      Swal.fire({
        imageUrl: imgSrc,
        imageAlt: e.target.alt || '이미지',
        showConfirmButton: false,
        showCloseButton: true,
        width: '90%',
        padding: '1rem',
        customClass: {
          image: 'image-popup'
        }
      });
    }
  });
}

// 메인으로 돌아가기
function initBackToMainBtn() {
  const backBtn = document.getElementById('backToMainBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
}

// 로그아웃
function initLogoutBtn() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        Swal.fire({
          icon: 'success',
          title: '로그아웃 완료',
          text: '성공적으로 로그아웃되었습니다.',
          confirmButtonText: '확인'
        }).then(() => {
          window.location.href = 'index.html';
        });
      } catch (error) {
        console.error('로그아웃 오류:', error);
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: '로그아웃 중 오류가 발생했습니다.'
        });
      }
    });
  }
}

// 인증 상태 확인 및 UI 업데이트
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    
    // 사용자 정보 표시
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const displayName = userData.name && userData.affiliation 
          ? `${userData.name} (${userData.affiliation})`
          : user.displayName || user.email;
        document.getElementById('userInfo').textContent = `👤 ${displayName}`;
      } else {
        document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email}`;
      }
    } catch (error) {
      console.error('사용자 정보 불러오기 오류:', error);
      document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email}`;
    }
    
    document.getElementById('logoutBtn').style.display = 'block';
  } else {
    currentUser = null;
    document.getElementById('userInfo').textContent = '🔐 로그인 후 이용해 주세요.';
    document.getElementById('logoutBtn').style.display = 'none';
  }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initMainTabs();
  initDocumentTabs();
  initQuestionTabs();
  initCriteriaTables();
  initViewProbingQuestionsBtn();
  initImagePopups();
  initBackToMainBtn();
  initLogoutBtn();
});

